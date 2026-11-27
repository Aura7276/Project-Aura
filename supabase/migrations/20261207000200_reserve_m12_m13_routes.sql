-- M12 and M13 added the Studio routes /creator/collaborations, /creator/earnings and /creator/invoices. Studio route words stay unclaimable as usernames (M09 rule).
insert into aura_profile.reserved_username(word) values ('collaborations'), ('earnings'), ('invoices') on conflict do nothing;
