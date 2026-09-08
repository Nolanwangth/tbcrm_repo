begin;

insert into public.itinerary_templates
  (city, template_type, title_zh, title_en, route_zh, route_en, requires_vehicle, requires_guide, included_en)
select seed.* from (values
  ('成都','arrival','成都抵达日','Arrival in Chengdu','机场接机 → 送酒店 → 自由活动','Airport pickup → Hotel transfer → Free time',true,false,array['Airport pickup','Driver']::text[]),
  ('成都','city_day','成都市区经典一日游','Chengdu City Highlights','武侯祠 → 锦里 → 杜甫草堂 → 宽窄巷子','Wuhou Shrine → Jinli Street → Du Fu Thatched Cottage → Kuanzhai Alley',true,true,array['Private car','Driver','Guide','Attraction tickets']::text[]),
  ('成都','outskirts_day','熊猫谷与都江堰一日游','Panda Valley & Dujiangyan','熊猫谷 → 都江堰景区 → 钟书阁','Panda Valley → Dujiangyan Irrigation System → Zhongshuge Bookstore',true,true,array['Private car','Driver','Guide','Attraction tickets']::text[]),
  ('成都','outskirts_day','乐山大佛一日游','Leshan Giant Buddha Day Tour','成都 → 乐山大佛 → 峨眉山报国寺 → 成都','Chengdu → Leshan Giant Buddha → Baoguo Temple → Chengdu',true,true,array['Private car','Driver','Guide','Attraction ticket']::text[]),
  ('重庆','city_day','重庆市区经典一日游','Chongqing City Highlights','李子坝 → 三峡博物馆 → 洪崖洞 → 解放碑','Liziba Station → Three Gorges Museum → Hongya Cave → Jiefangbei',true,true,array['Private car','Driver','Guide']::text[]),
  ('重庆','evening','重庆夜景体验','Chongqing Nightscape Experience','南山一棵树 → 洪崖洞 → 两江夜游','Nanshan Viewpoint → Hongya Cave → Two Rivers Night Cruise',true,false,array['Private car','Driver','Night cruise ticket']::text[])
) as seed(city, template_type, title_zh, title_en, route_zh, route_en, requires_vehicle, requires_guide, included_en)
where not exists (
  select 1 from public.itinerary_templates existing
  where existing.city = seed.city and existing.title_zh = seed.title_zh
);

commit;
