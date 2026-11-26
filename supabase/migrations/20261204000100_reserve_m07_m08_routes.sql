-- M07 and M08 added the Studio routes /creator/ai and /creator/content. Every Studio route word must stay unclaimable as a username (M09 rule).
insert into aura_profile.reserved_username(word) values ('ai'), ('content') on conflict do nothing;
