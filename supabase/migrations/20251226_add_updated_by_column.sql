-- Add updated_by column to board_items table to track who last edited a card
ALTER TABLE public.board_items
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id);

-- Comment for clarity
COMMENT ON COLUMN public.board_items.updated_by IS 'User ID of the person who last edited this item';

