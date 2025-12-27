-- Add z_index column to board_items table for layering control
-- This allows users to bring items to front or send to back

ALTER TABLE public.board_items
ADD COLUMN IF NOT EXISTS z_index integer DEFAULT 0;

-- Create index for efficient ordering by z_index
CREATE INDEX IF NOT EXISTS idx_board_items_z_index ON public.board_items (z_index);

-- Comment for clarity
COMMENT ON COLUMN public.board_items.z_index IS 'Z-order for layering items. Higher values appear on top.';
