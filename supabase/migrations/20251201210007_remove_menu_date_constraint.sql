-- Remove unique constraint from menu_entries.menu_date
ALTER TABLE menu_entries DROP CONSTRAINT IF EXISTS menu_entries_menu_date_key;
