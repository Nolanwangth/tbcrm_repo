begin;


create table public.quote_products (
  id uuid primary key default gen_random_uuid(), city text not null default '通用', category text not null,
  name_zh text not null check (char_length(btrim(name_zh)) > 0), name_en text not null check (char_length(btrim(name_en)) > 0),
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0), quote_price numeric(14,2) not null default 0 check (quote_price >= 0),
  pricing_unit text not null check (pricing_unit in ('per_occurrence','per_day','per_person','per_person_day','fixed_total')),
  guide_language text, seat_count integer check (seat_count is null or seat_count > 0), enabled boolean not null default true,
  created_by_user_id uuid references public.crm_users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index quote_products_city_enabled_idx on public.quote_products(city, enabled);
create trigger quote_products_set_updated_at before update on public.quote_products for each row execute function public.set_updated_at();

create table public.itinerary_templates (
  id uuid primary key default gen_random_uuid(), city text not null default '通用',
  template_type text not null check (template_type in ('arrival','departure','city_day','outskirts_day','evening','custom')),
  title_zh text not null, title_en text not null, route_zh text not null, route_en text not null,
  requires_vehicle boolean not null default false, requires_guide boolean not null default false,
  linked_product_ids uuid[] not null default '{}', included_en text[] not null default '{}', enabled boolean not null default true,
  created_by_user_id uuid references public.crm_users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index itinerary_templates_city_enabled_idx on public.itinerary_templates(city, enabled);
create trigger itinerary_templates_set_updated_at before update on public.itinerary_templates for each row execute function public.set_updated_at();

create table public.customer_proposals (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0), traveler_count integer not null check (traveler_count between 1 and 99),
  guide_language text, auto_match boolean not null default true, status text not null default 'draft' check (status in ('draft','published','archived')),
  published_version_id uuid, created_by_user_id uuid references public.crm_users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index customer_proposals_customer_updated_idx on public.customer_proposals(customer_id, updated_at desc);
create trigger customer_proposals_set_updated_at before update on public.customer_proposals for each row execute function public.set_updated_at();

create table public.customer_proposal_days (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.customer_proposals(id) on delete cascade,
  day_number integer not null check (day_number > 0), service_date date, city text not null default '', title_zh text not null default '',
  title_en text not null default '', route_zh text not null default '', route_en text not null default '',
  requires_vehicle boolean not null default false, requires_guide boolean not null default false, notes text, unique(proposal_id, day_number)
);

create table public.customer_proposal_items (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.customer_proposals(id) on delete cascade,
  proposal_day_id uuid references public.customer_proposal_days(id) on delete set null, quote_product_id uuid references public.quote_products(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','template','auto')), category text not null, name_zh text not null, name_en text not null,
  details text, quantity numeric(12,2) not null check (quantity > 0), cost_price numeric(14,2) not null check (cost_price >= 0),
  quote_price numeric(14,2) not null check (quote_price >= 0), pricing_unit text not null check (pricing_unit in ('per_occurrence','per_day','per_person','per_person_day','fixed_total')),
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index customer_proposal_items_proposal_sort_idx on public.customer_proposal_items(proposal_id, sort_order);
create trigger customer_proposal_items_set_updated_at before update on public.customer_proposal_items for each row execute function public.set_updated_at();

create table public.customer_proposal_versions (
  id uuid primary key default gen_random_uuid(), proposal_id uuid not null references public.customer_proposals(id) on delete cascade,
  version_number integer not null check (version_number > 0), version_note text, snapshot jsonb not null, published_at timestamptz,
  published_by_user_id uuid references public.crm_users(id) on delete set null, created_by_user_id uuid references public.crm_users(id) on delete set null,
  created_at timestamptz not null default now(), unique(proposal_id, version_number)
);
alter table public.customer_proposals add constraint customer_proposals_published_version_fk foreign key (published_version_id) references public.customer_proposal_versions(id) on delete set null;
create index customer_proposal_versions_proposal_created_idx on public.customer_proposal_versions(proposal_id, created_at desc);

create table public.customer_proposal_documents (
  id uuid primary key default gen_random_uuid(), proposal_version_id uuid not null references public.customer_proposal_versions(id) on delete cascade,
  customer_file_id uuid references public.customer_files(id) on delete set null,
  document_type text not null check (document_type in ('itinerary','quotation','internal_cost_sheet','proforma_invoice')),
  generated_by_user_id uuid references public.crm_users(id) on delete set null, created_at timestamptz not null default now()
);
create index customer_proposal_documents_version_idx on public.customer_proposal_documents(proposal_version_id, created_at desc);

alter table public.quote_products enable row level security;
alter table public.itinerary_templates enable row level security;
alter table public.customer_proposals enable row level security;
alter table public.customer_proposal_days enable row level security;
alter table public.customer_proposal_items enable row level security;
alter table public.customer_proposal_versions enable row level security;
alter table public.customer_proposal_documents enable row level security;
revoke all on public.quote_products, public.itinerary_templates, public.customer_proposals, public.customer_proposal_days, public.customer_proposal_items, public.customer_proposal_versions, public.customer_proposal_documents from anon, authenticated;
grant select, insert, update, delete on public.quote_products, public.itinerary_templates, public.customer_proposals, public.customer_proposal_days, public.customer_proposal_items, public.customer_proposal_versions, public.customer_proposal_documents to service_role;

insert into public.quote_products (city, category, name_zh, name_en, cost_price, quote_price, pricing_unit, seat_count) values
  ('成都','接机','7座接机服务（成都）','7-seat airport pickup (Chengdu)',320,480,'per_occurrence',7),
  ('成都','市区用车','7座市区用车（成都）','7-seat city car service (Chengdu)',400,560,'per_day',7),
  ('成都','多语言导游','英语导游（成都）','English-speaking guide (Chengdu)',600,900,'per_day',null),
  ('通用','保险','旅游保险','Travel insurance',5,10,'per_person_day',null),
  ('通用','服务费','行程服务费','Tour service fee',0,30,'per_person_day',null)
on conflict do nothing;

commit;
