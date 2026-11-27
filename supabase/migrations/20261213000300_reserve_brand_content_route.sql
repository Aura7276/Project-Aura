-- /brand/content (M21) is a private Brand route, so it cannot become a public Brand address.
insert into aura_brand.reserved_slug(word) values ('content') on conflict do nothing;
