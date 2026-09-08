begin;

create index if not exists customer_folders_parent_id_idx
  on public.customer_folders (parent_id);

create index if not exists customer_files_folder_id_idx
  on public.customer_files (folder_id);

commit;
