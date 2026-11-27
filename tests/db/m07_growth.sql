-- Run after the M04 test fixture has provisioned and activated its two test creators.
do $$ declare id uuid:=gen_random_uuid(); w uuid:=t.ws('a'); s jsonb; before int;begin
perform t.me('a');
before:=(public.aura_studio_ideas(w)->>'total')::int; -- the M04 fixture may already have ideas for this creator
perform public.aura_growth_save(w,id,'Weekly practice','Try one new framing','Plan',7,'English');
perform public.aura_growth_turn(w,id,'Review this plan','Review lighting first');
perform public.aura_growth_memory(w,true,'Short replies',false,'weekly');
s:=public.aura_growth_state(w);
assert s->'drafts'->0->'history'->0->>'reply'='Review lighting first';
assert s->'memory'->>'cadence'='weekly';
assert not public.aura_growth_reserve(w);
perform public.aura_growth_approve(w,id);perform public.aura_growth_approve(w,id);
assert (public.aura_studio_ideas(w)->>'total')::int=before+1; -- approving twice adds exactly one idea
perform public.aura_growth_memory(w,false,'',true,'off');
assert public.aura_growth_state(w)->'memory'->>'preferences'='';
reset role;perform t.me('b');
assert t.denied(format('select public.aura_growth_state(%L)',w));
assert t.denied(format('select public.aura_growth_approve(%L,%L)',w,id));reset role;
end $$;
