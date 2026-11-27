-- M23 added /brand/agencies (and the /agency area). These stay unclaimable as public Brand addresses (M14 rule).
insert into aura_brand.reserved_slug(word) values ('agency'), ('agencies') on conflict do nothing;
