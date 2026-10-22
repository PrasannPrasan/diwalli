create table if not exists rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null check (char_length(guest_name) between 1 and 80),
  attendance_status text not null check (attendance_status in ('going','declined')),
  arrival_note text not null default '',
  drink_preference text not null check (drink_preference in ('alcoholic','non-alcoholic','both')),
  bringing_anyone boolean not null default false,
  additional_guest_count int not null default 0 check (additional_guest_count >= 0),
  additional_guest_names text not null default '',
  total_attendees int not null default 0,
  guest_message text not null default '',
  edit_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
