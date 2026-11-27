-- /brand/assistant (M20) is a private Brand route, so it cannot become a public Brand address.
insert into aura_brand.reserved_slug(word) values ('assistant') on conflict do nothing;
