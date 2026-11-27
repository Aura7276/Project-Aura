-- M23 added the Studio route /creator/agencies. Studio route words stay unclaimable as usernames (M09 rule).
insert into aura_profile.reserved_username(word) values ('agencies') on conflict do nothing;
