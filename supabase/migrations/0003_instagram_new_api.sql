-- New Instagram API (with Business Login) doesn't require a Facebook Page.
-- Make facebook_page_id nullable for backward compatibility with old rows;
-- new rows leave it NULL.
alter table public.instagram_connections
  alter column facebook_page_id drop not null;
