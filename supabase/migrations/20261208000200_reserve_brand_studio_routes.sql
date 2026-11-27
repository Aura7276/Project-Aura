-- M15 added /brand/workspaces/[workspace] (Brand Studio). Brand area routes stay unclaimable as public Brand addresses (M14 rule).
insert into aura_brand.reserved_slug(word) values ('workspaces'), ('dashboard') on conflict do nothing;
