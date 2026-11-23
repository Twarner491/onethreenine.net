-- Keep the photo's existing edit attribution and timestamp during a media-only swap.
create or replace trigger update_board_items_updated_at
before update on public.board_items
for each row
when (
  current_user <> 'service_role'
  or not (
    old.type = 'photo'
    and (to_jsonb(old) - 'content') = (to_jsonb(new) - 'content')
    and (old.content - 'imageUrl') = (new.content - 'imageUrl')
    and (
      (coalesce(old.content ->> 'imageUrl', '') like '%/storage/v1/object/public/board-images/%'
        and coalesce(new.content ->> 'imageUrl', '') like '%/storage/v1/object/public/board-display-images/%')
      or
      (coalesce(old.content ->> 'imageUrl', '') like '%/storage/v1/object/public/board-display-images/%'
        and coalesce(new.content ->> 'imageUrl', '') like '%/storage/v1/object/public/board-images/%')
    )
  )
)
execute function public.update_updated_at_column();

-- A compare-and-set swap leaves concurrent edits and deleted items alone.
create or replace function public.swap_board_photo_urls(changes jsonb)
returns uuid[]
language sql
security invoker
set search_path = ''
as $$
  with swapped as (
    update public.board_items as item
    set content = jsonb_set(item.content, '{imageUrl}', to_jsonb(change.display_url), false)
    from jsonb_to_recordset(changes)
      as change(item_id uuid, expected_url text, display_url text)
    where item.id = change.item_id
      and item.type = 'photo'
      and item.content ->> 'imageUrl' = change.expected_url
      and change.display_url <> change.expected_url
    returning item.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) from swapped;
$$;

revoke all on function public.swap_board_photo_urls(jsonb) from public, anon, authenticated;
grant execute on function public.swap_board_photo_urls(jsonb) to service_role;
