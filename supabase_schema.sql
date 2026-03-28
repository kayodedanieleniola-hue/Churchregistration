create table if not exists public.registrations (
  id bigint generated always as identity primary key,
  full_name text not null,
  email text not null unique,
  phone text,
  dob text,
  age integer,
  gender text,
  address text,
  department text,
  marital_status text,
  state_origin text,
  nationality text,
  occupation text,
  first_time text,
  inviter text,
  why_joined text,
  prayer_request text,
  nok_name text,
  nok_phone text,
  member_id text not null unique,
  photo_path text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists registrations_created_at_idx
  on public.registrations (created_at desc);

create index if not exists registrations_department_idx
  on public.registrations (department);

create index if not exists registrations_gender_idx
  on public.registrations (gender);
