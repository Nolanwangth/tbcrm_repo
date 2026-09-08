import type { PriceProduct, RouteTemplate, TemplateType } from "../types";
type ImportedDay = {
    id: string;
    city: string;
    type: TemplateType;
    titleZh: string;
    titleEn: string;
    routeZh: string;
    routeEn: string;
    quote?: number;
};
const days: ImportedDay[] = [
    { id: "khoi-01", city: "上海", type: "抵达日", titleZh: "上海抵达与外滩漫步", titleEn: "Shanghai Arrival & Bund Walk", routeZh: "机场接机 → 就医取药 → 南京东路 → 豫园 → 外滩", routeEn: "Airport pickup → Medical stop → East Nanjing Road → Yu Garden → The Bund", quote: 690 },
    { id: "khoi-02", city: "上海", type: "郊区一日游", titleZh: "朱家角水乡一日游", titleEn: "Zhujiajiao Water Town Day Tour", routeZh: "上海 → 朱家角古镇 → 上海", routeEn: "Shanghai → Zhujiajiao Water Town → Shanghai", quote: 2320 },
    { id: "khoi-03", city: "上海", type: "自定义一日模板", titleZh: "上海至张家界转场", titleEn: "Shanghai to Zhangjiajie Transfer", routeZh: "上海送机 → 飞往张家界 → 张家界接机 → 七十二奇楼", routeEn: "Shanghai airport transfer → Flight to Zhangjiajie → Airport pickup → 72 Qilou", quote: 1080 },
    { id: "khoi-04", city: "张家界", type: "郊区一日游", titleZh: "张家界森林公园与重庆转场", titleEn: "Zhangjiajie Forest Park & Chongqing Transfer", routeZh: "张家界森林公园 → 袁家界 → 车站送站 → 重庆接站", routeEn: "Zhangjiajie National Forest Park → Yuanjiajie → Station transfer → Chongqing pickup", quote: 3768 },
    { id: "khoi-05", city: "重庆", type: "市区一日游", titleZh: "重庆城市精华与无人机表演", titleEn: "Chongqing Highlights & Drone Show", routeZh: "李子坝 → 鹅岭二厂 → 魁星楼 → 解放碑 → 无人机表演", routeEn: "Liziba → Eling No. 2 Factory → Kuixinglou → Jiefangbei → Drone show", quote: 3486 },
    { id: "khoi-06", city: "重庆", type: "自定义一日模板", titleZh: "重庆至西安转场", titleEn: "Chongqing to Xi'an Transfer", routeZh: "重庆送站 → 高铁前往西安 → 西安接站", routeEn: "Chongqing station transfer → Train to Xi'an → Xi'an pickup", quote: 880 },
    { id: "khoi-07", city: "西安", type: "郊区一日游", titleZh: "秦始皇兵马俑一日游", titleEn: "Terracotta Warriors Day Tour", routeZh: "西安市区 → 秦始皇兵马俑博物馆 → 西安市区", routeEn: "Xi'an → Terracotta Army Museum → Xi'an", quote: 2200 },
    { id: "khoi-08", city: "西安", type: "自定义一日模板", titleZh: "西安至北京转场", titleEn: "Xi'an to Beijing Transfer", routeZh: "西安送站 → 高铁前往北京 → 北京接站", routeEn: "Xi'an station transfer → Train to Beijing → Beijing pickup", quote: 1010 },
    { id: "khoi-09", city: "北京", type: "市区一日游", titleZh: "北京皇城与杂技表演", titleEn: "Imperial Beijing & Acrobatics", routeZh: "天安门广场 → 故宫 → 天坛 → 秦乐宫杂技", routeEn: "Tiananmen Square → Forbidden City → Temple of Heaven → Qinlegong Acrobatics", quote: 3634 },
    { id: "khoi-10", city: "北京", type: "郊区一日游", titleZh: "慕田峪长城与送机", titleEn: "Mutianyu Great Wall & Departure", routeZh: "北京 → 慕田峪长城 → 机场或酒店", routeEn: "Beijing → Mutianyu Great Wall → Airport or hotel", quote: 4170 },
    { id: "jasmine-01", city: "北京", type: "郊区一日游", titleZh: "北京野生动物园一日游", titleEn: "Beijing Wildlife Park Day Tour", routeZh: "北京市区 → 北京野生动物园 → 北京市区", routeEn: "Beijing → Beijing Wildlife Park → Beijing", quote: 2150 },
    { id: "jasmine-02", city: "北京", type: "市区一日游", titleZh: "颐和园、北海与杂技表演", titleEn: "Summer Palace, Beihai & Acrobatics", routeZh: "颐和园 → 北海公园 → 秦乐宫杂技", routeEn: "Summer Palace → Beihai Park → Qinlegong Acrobatics", quote: 4450 },
    { id: "martjin-00", city: "北京", type: "郊区一日游", titleZh: "慕田峪长城与颐和园", titleEn: "Mutianyu Great Wall & Summer Palace", routeZh: "北京 → 慕田峪长城 → 颐和园 → 北京", routeEn: "Beijing → Mutianyu Great Wall → Summer Palace → Beijing", quote: 2570 },
    { id: "martjin-09", city: "张家界", type: "郊区一日游", titleZh: "天门山全景一日游", titleEn: "Tianmen Mountain Panorama", routeZh: "天门山索道 → 天门洞 → 玻璃栈道", routeEn: "Tianmen Mountain Cableway → Tianmen Cave → Glass Skywalk", quote: 680 },
    { id: "martjin-10", city: "张家界", type: "郊区一日游", titleZh: "袁家界与阿凡达山", titleEn: "Yuanjiajie & Avatar Mountain", routeZh: "张家界森林公园 → 百龙天梯 → 袁家界 → 乾坤柱 → 天下第一桥", routeEn: "Zhangjiajie Forest Park → Bailong Elevator → Yuanjiajie → Avatar Mountain → First Bridge", quote: 904 },
    { id: "martjin-11", city: "张家界", type: "郊区一日游", titleZh: "大峡谷玻璃桥与黄龙洞", titleEn: "Grand Canyon Glass Bridge & Huanglong Cave", routeZh: "张家界大峡谷 → 玻璃桥 → 黄龙洞", routeEn: "Zhangjiajie Grand Canyon → Glass Bridge → Huanglong Cave", quote: 826 },
    { id: "martjin-12", city: "张家界", type: "郊区一日游", titleZh: "七星山与芙蓉镇夜景", titleEn: "Qixing Mountain & Furong Night View", routeZh: "张家界 → 七星山飞拉达 → 芙蓉镇瀑布夜景", routeEn: "Zhangjiajie → Qixing Mountain Via Ferrata → Furong Waterfall Night View", quote: 1600 },
    { id: "martjin-13", city: "芙蓉镇", type: "市区一日游", titleZh: "芙蓉古镇与酉水河", titleEn: "Furong Ancient Town & Youshui River", routeZh: "芙蓉古镇 → 芙蓉镇瀑布 → 酉水河", routeEn: "Furong Ancient Town → Furong Waterfall → Youshui River" },
    { id: "jose-01", city: "成都", type: "郊区一日游", titleZh: "乐山大佛与东方佛都", titleEn: "Leshan Giant Buddha & Oriental Buddha Capital", routeZh: "成都 → 乐山大佛游船 → 东方佛都 → 张公桥美食街 → 成都", routeEn: "Chengdu → Leshan Giant Buddha Cruise → Oriental Buddha Capital → Zhanggongqiao Food Street → Chengdu", quote: 1390 },
    { id: "soumya-01", city: "北京", type: "抵达日", titleZh: "北京抵达日", titleEn: "Arrival in Beijing", routeZh: "北京机场接机 → 酒店", routeEn: "Beijing airport pickup → Hotel", quote: 460 },
    { id: "soumya-02", city: "北京", type: "市区一日游", titleZh: "故宫博物院一日游", titleEn: "Forbidden City Day Tour", routeZh: "天安门广场 → 故宫博物院 → 景山公园", routeEn: "Tiananmen Square → Forbidden City → Jingshan Park", quote: 2120 },
    { id: "soumya-03", city: "北京", type: "郊区一日游", titleZh: "慕田峪长城一日游", titleEn: "Mutianyu Great Wall Day Tour", routeZh: "北京 → 慕田峪长城 → 北京", routeEn: "Beijing → Mutianyu Great Wall → Beijing", quote: 2115 },
    { id: "soumya-04", city: "北京", type: "自定义一日模板", titleZh: "颐和园与西安转场", titleEn: "Summer Palace & Xi'an Transfer", routeZh: "颐和园 → 北京送站 → 高铁前往西安 → 西安接站", routeEn: "Summer Palace → Beijing station transfer → Train to Xi'an → Xi'an pickup", quote: 2580 },
    { id: "soumya-05", city: "西安", type: "郊区一日游", titleZh: "兵马俑与丽山园", titleEn: "Terracotta Warriors & Lishan Garden", routeZh: "西安 → 兵马俑博物馆 → 丽山园 → 西安", routeEn: "Xi'an → Terracotta Army Museum → Lishan Garden → Xi'an", quote: 1700 },
    { id: "soumya-06", city: "西安", type: "市区一日游", titleZh: "大慈恩寺与大雁塔", titleEn: "Daci'en Temple & Giant Wild Goose Pagoda", routeZh: "大慈恩寺 → 大雁塔 → 西安市区", routeEn: "Daci'en Temple → Giant Wild Goose Pagoda → Xi'an city", quote: 1530 },
    { id: "soumya-07", city: "西安", type: "自定义一日模板", titleZh: "西安至成都转场", titleEn: "Xi'an to Chengdu Transfer", routeZh: "西安送站 → 高铁前往成都 → 成都接站", routeEn: "Xi'an station transfer → Train to Chengdu → Chengdu pickup", quote: 520 },
    { id: "soumya-08", city: "成都", type: "郊区一日游", titleZh: "熊猫谷与都江堰", titleEn: "Panda Valley & Dujiangyan", routeZh: "成都 → 熊猫谷 → 都江堰 → 成都", routeEn: "Chengdu → Panda Valley → Dujiangyan → Chengdu", quote: 2210 },
    { id: "soumya-09", city: "成都", type: "郊区一日游", titleZh: "乐山大佛深度一日游", titleEn: "Leshan Giant Buddha Full Day", routeZh: "成都 → 乐山大佛 → 游船 → 东方佛都 → 成都", routeEn: "Chengdu → Leshan Giant Buddha → River Cruise → Oriental Buddha Capital → Chengdu", quote: 2720 },
    { id: "soumya-10", city: "成都", type: "自定义一日模板", titleZh: "成都至重庆转场", titleEn: "Chengdu to Chongqing Transfer", routeZh: "成都送站 → 高铁前往重庆 → 重庆接站", routeEn: "Chengdu station transfer → Train to Chongqing → Chongqing pickup", quote: 460 },
    { id: "soumya-11", city: "重庆", type: "市区一日游", titleZh: "重庆城市精华一日游", titleEn: "Chongqing City Highlights", routeZh: "李子坝 → 魁星楼 → 解放碑 → 洪崖洞", routeEn: "Liziba → Kuixinglou → Jiefangbei → Hongya Cave", quote: 1810 },
    { id: "soumya-12", city: "重庆", type: "夜游或晚间活动", titleZh: "重庆城市游与《重庆·1949》", titleEn: "Chongqing City & 1949 Show", routeZh: "重庆市区 → 《重庆·1949》演出", routeEn: "Chongqing city tour → Chongqing 1949 Show", quote: 3008 },
    { id: "soumya-13", city: "重庆", type: "自定义一日模板", titleZh: "重庆至桂林转场", titleEn: "Chongqing to Guilin Transfer", routeZh: "重庆送站 → 高铁前往桂林 → 桂林接站", routeEn: "Chongqing station transfer → Train to Guilin → Guilin pickup", quote: 460 },
    { id: "soumya-14", city: "桂林", type: "郊区一日游", titleZh: "漓江游船至阳朔", titleEn: "Li River Cruise to Yangshuo", routeZh: "桂林 → 四星漓江游船 → 阳朔", routeEn: "Guilin → Four-star Li River Cruise → Yangshuo", quote: 1690 },
    { id: "soumya-15", city: "阳朔", type: "郊区一日游", titleZh: "阳朔山水一日游", titleEn: "Yangshuo Countryside Day Tour", routeZh: "阳朔乡村 → 喀斯特山水 → 阳朔", routeEn: "Yangshuo countryside → Karst landscapes → Yangshuo", quote: 1870 },
    { id: "soumya-16", city: "桂林", type: "自定义一日模板", titleZh: "桂林至上海转场", titleEn: "Guilin to Shanghai Transfer", routeZh: "桂林送机 → 飞往上海 → 上海接机", routeEn: "Guilin airport transfer → Flight to Shanghai → Shanghai pickup", quote: 970 },
    { id: "soumya-17", city: "上海", type: "郊区一日游", titleZh: "乌镇西栅一日游", titleEn: "Wuzhen Xizha Day Tour", routeZh: "上海 → 乌镇西栅 → 上海", routeEn: "Shanghai → Wuzhen Xizha Scenic Area → Shanghai", quote: 3430 },
    { id: "soumya-18", city: "上海", type: "郊区一日游", titleZh: "上海迪士尼接送日", titleEn: "Shanghai Disneyland Transfer Day", routeZh: "上海酒店 → 上海迪士尼 → 酒店", routeEn: "Shanghai hotel → Shanghai Disneyland → Hotel", quote: 780 },
    { id: "soumya-19", city: "上海", type: "郊区一日游", titleZh: "上海海昌海洋公园", titleEn: "Shanghai Haichang Ocean Park", routeZh: "上海 → 海昌海洋公园 → 上海", routeEn: "Shanghai → Haichang Ocean Park → Shanghai", quote: 2716 },
    { id: "soumya-20", city: "上海", type: "市区一日游", titleZh: "豫园与汉服体验", titleEn: "Yu Garden & Hanfu Experience", routeZh: "上海市区 → 豫园 → 汉服妆造体验", routeEn: "Shanghai city → Yu Garden → Hanfu makeup experience", quote: 4532 },
    { id: "soumya-21", city: "上海", type: "离开日", titleZh: "上海离开日", titleEn: "Departure from Shanghai", routeZh: "酒店 → 上海机场送机", routeEn: "Hotel → Shanghai airport transfer", quote: 450 },
    { id: "penny-01", city: "张家界", type: "抵达日", titleZh: "张家界抵达与七十二奇楼", titleEn: "Zhangjiajie Arrival & 72 Qilou", routeZh: "机场接机 → 酒店 → 七十二奇楼外观", routeEn: "Airport pickup → Hotel → 72 Qilou exterior", quote: 260 },
    { id: "penny-02", city: "张家界", type: "郊区一日游", titleZh: "茅岩河漂流一日游", titleEn: "Maoyan River Rafting", routeZh: "张家界 → 茅岩河机动漂流 → 张家界", routeEn: "Zhangjiajie → Maoyan River Motorized Rafting → Zhangjiajie", quote: 1146 },
    { id: "penny-03", city: "张家界", type: "郊区一日游", titleZh: "七星山飞拉达与天门山", titleEn: "Qixing Via Ferrata & Tianmen Mountain", routeZh: "七星山飞拉达 → 天门山 → 天门洞 → 玻璃栈道", routeEn: "Qixing Mountain Via Ferrata → Tianmen Mountain → Tianmen Cave → Glass Skywalk", quote: 3620 },
    { id: "penny-04", city: "张家界", type: "郊区一日游", titleZh: "大峡谷玻璃桥与黄龙洞", titleEn: "Grand Canyon Glass Bridge & Huanglong Cave", routeZh: "张家界大峡谷 → 玻璃桥与滑索 → 黄龙洞", routeEn: "Zhangjiajie Grand Canyon → Glass Bridge & Zipline → Huanglong Cave", quote: 2526 },
    { id: "penny-05", city: "张家界", type: "离开日", titleZh: "张家界离开日", titleEn: "Departure from Zhangjiajie", routeZh: "酒店 → 张家界机场送机", routeEn: "Hotel → Zhangjiajie airport transfer", quote: 260 },
    { id: "mitra-01", city: "北京", type: "抵达日", titleZh: "北京抵达日", titleEn: "Arrival in Beijing", routeZh: "北京机场接机 → 酒店入住", routeEn: "Beijing airport pickup → Hotel check-in", quote: 480 },
    { id: "mitra-02", city: "北京", type: "市区一日游", titleZh: "天安门、故宫与景山", titleEn: "Tiananmen, Forbidden City & Jingshan", routeZh: "天安门广场 → 故宫 → 景山公园", routeEn: "Tiananmen Square → Forbidden City → Jingshan Park", quote: 2140 },
    { id: "mitra-03", city: "北京", type: "郊区一日游", titleZh: "慕田峪长城与颐和园", titleEn: "Mutianyu Great Wall & Summer Palace", routeZh: "慕田峪长城 → 颐和园 → 昆明湖", routeEn: "Mutianyu Great Wall → Summer Palace → Kunming Lake", quote: 2900 },
    { id: "mitra-04", city: "北京", type: "自定义一日模板", titleZh: "天坛与西安转场", titleEn: "Temple of Heaven & Xi'an Transfer", routeZh: "天坛 → 北京送站 → 西安接站", routeEn: "Temple of Heaven → Beijing station transfer → Xi'an pickup", quote: 2618 },
    { id: "mitra-05", city: "西安", type: "郊区一日游", titleZh: "兵马俑与华清宫", titleEn: "Terracotta Warriors & Huaqing Palace", routeZh: "兵马俑 → 华清宫 → 大唐不夜城", routeEn: "Terracotta Warriors → Huaqing Palace → Grand Tang Mall", quote: 2240 },
    { id: "mitra-06", city: "西安", type: "自定义一日模板", titleZh: "古城西安与重庆转场", titleEn: "Historic Xi'an & Chongqing Transfer", routeZh: "大慈恩寺 → 大雁塔 → 清真大寺 → 西安送站 → 重庆接站", routeEn: "Daci'en Temple → Giant Wild Goose Pagoda → Great Mosque → Xi'an station → Chongqing pickup", quote: 2160 },
    { id: "mitra-07", city: "重庆", type: "市区一日游", titleZh: "重庆城市精华与《重庆·1949》", titleEn: "Chongqing Highlights & 1949 Show", routeZh: "解放碑 → 罗汉寺 → 李子坝 → 《重庆·1949》", routeEn: "Jiefangbei → Luohan Temple → Liziba → Chongqing 1949 Show", quote: 2588 },
    { id: "mitra-08", city: "重庆", type: "市区一日游", titleZh: "重庆动物园与两江夜游", titleEn: "Chongqing Zoo & Two Rivers Cruise", routeZh: "重庆动物园与熊猫馆 → 长江索道 → 两江夜游", routeEn: "Chongqing Zoo & Panda Pavilion → Yangtze Cableway → Two Rivers Cruise", quote: 2576 },
    { id: "mitra-09", city: "重庆", type: "郊区一日游", titleZh: "大足石刻一日游", titleEn: "Dazu Rock Carvings Day Tour", routeZh: "重庆 → 宝顶山石刻 → 大足石刻 → 重庆", routeEn: "Chongqing → Baodingshan Carvings → Dazu Rock Carvings → Chongqing", quote: 2398 },
    { id: "mitra-10", city: "重庆", type: "自定义一日模板", titleZh: "武隆喀斯特与张家界转场", titleEn: "Wulong Karst & Zhangjiajie Transfer", routeZh: "重庆 → 天生三桥 → 龙水峡地缝 → 武隆送站 → 张家界接站 → 七十二奇楼", routeEn: "Chongqing → Three Natural Bridges → Longshuixia Fissure → Wulong station → Zhangjiajie pickup → 72 Qilou", quote: 3050 },
    { id: "mitra-11", city: "张家界", type: "郊区一日游", titleZh: "张家界森林公园与袁家界", titleEn: "Zhangjiajie Forest Park & Yuanjiajie", routeZh: "森林公园 → 百龙天梯 → 袁家界 → 阿凡达山", routeEn: "Forest Park → Bailong Elevator → Yuanjiajie → Avatar Mountain", quote: 1917 },
    { id: "mitra-12", city: "张家界", type: "郊区一日游", titleZh: "天门山与宝峰湖", titleEn: "Tianmen Mountain & Baofeng Lake", routeZh: "天门山 → 天门洞 → 玻璃栈道 → 宝峰湖", routeEn: "Tianmen Mountain → Tianmen Cave → Glass Skywalk → Baofeng Lake", quote: 2062 },
    { id: "mitra-13", city: "张家界", type: "郊区一日游", titleZh: "大峡谷、黄龙洞与芙蓉镇", titleEn: "Grand Canyon, Huanglong Cave & Furong", routeZh: "张家界大峡谷 → 黄龙洞 → 芙蓉镇", routeEn: "Zhangjiajie Grand Canyon → Huanglong Cave → Furong Town", quote: 3508 },
    { id: "mitra-14", city: "芙蓉镇", type: "自定义一日模板", titleZh: "芙蓉镇至桂林转场", titleEn: "Furong to Guilin Transfer", routeZh: "芙蓉古镇 → 芙蓉镇送站 → 桂林接站", routeEn: "Furong Ancient Town → Furong station transfer → Guilin pickup", quote: 1680 },
    { id: "mitra-15", city: "桂林", type: "郊区一日游", titleZh: "漓江游船与如意峰", titleEn: "Li River Cruise & Ruyi Peak", routeZh: "桂林码头 → 漓江游船 → 阳朔 → 如意峰", routeEn: "Guilin pier → Li River Cruise → Yangshuo → Ruyi Peak", quote: 2840 },
    { id: "mitra-16", city: "阳朔", type: "郊区一日游", titleZh: "遇龙河竹筏与桂林转场", titleEn: "Yulong River Raft & Guilin Transfer", routeZh: "阳朔 → 遇龙河竹筏 → 桂林", routeEn: "Yangshuo → Yulong River Bamboo Raft → Guilin", quote: 2790 },
    { id: "mitra-17", city: "上海", type: "自定义一日模板", titleZh: "桂林至上海与朱家角", titleEn: "Guilin to Shanghai & Zhujiajiao", routeZh: "桂林送机 → 上海接机 → 静安寺 → 朱家角 → 外滩", routeEn: "Guilin airport transfer → Shanghai pickup → Jing'an Temple → Zhujiajiao → The Bund", quote: 4280 },
    { id: "mitra-18", city: "上海", type: "郊区一日游", titleZh: "苏州园林与同里古镇", titleEn: "Suzhou Gardens & Tongli Water Town", routeZh: "上海 → 拙政园 → 同里古镇与游船 → 上海", routeEn: "Shanghai → Humble Administrator's Garden → Tongli Water Town & Boat Ride → Shanghai", quote: 3640 },
    { id: "mitra-19", city: "上海", type: "离开日", titleZh: "豫园与上海离开日", titleEn: "Yu Garden & Shanghai Departure", routeZh: "豫园 → 上海市区 → 机场送机", routeEn: "Yu Garden → Shanghai city → Airport transfer", quote: 2400 },
];
type ImportedService = Pick<PriceProduct, "category" | "nameZh" | "nameEn" | "quotePrice">;
type ServiceInput = [
    ImportedService["category"],
    string,
    string,
    number
];
const servicesByDay: Record<string, ImportedService[]> = {};
const service = (dayId: string, ...items: ServiceInput[]) => {
    servicesByDay[dayId] = items.map(([category, nameZh, nameEn, quotePrice]) => ({ category, nameZh, nameEn, quotePrice }));
};
service("khoi-01", ["接机", "上海9座接机", "Shanghai airport pickup (9-seat vehicle)", 590]);
service("khoi-02", ["郊区用车", "上海至朱家角9座用车", "Shanghai–Zhujiajiao transfer (9-seat vehicle)", 1120], ["多语言导游", "上海英语导游", "English-speaking guide in Shanghai", 1100]);
service("khoi-03", ["送机", "上海9座送机", "Shanghai airport drop-off (9-seat vehicle)", 590], ["接机", "张家界接机及七十二奇楼用车", "Zhangjiajie airport pickup and 72 Qilou transfer", 390]);
service("khoi-04", ["郊区用车", "张家界森林公园往返用车", "Zhangjiajie Forest Park round-trip transfer", 390], ["送站", "张家界送站", "Zhangjiajie station drop-off", 260], ["接站", "重庆接站", "Chongqing station pickup", 390], ["多语言导游", "张家界英语导游", "English-speaking guide in Zhangjiajie", 900], ["景点门票", "张家界森林公园套票（4张）", "Zhangjiajie Forest Park combo tickets (4)", 1728]);
service("khoi-05", ["市区用车", "重庆9座市区用车", "Chongqing city transfer (9-seat vehicle)", 1050], ["多语言导游", "重庆英语导游", "English-speaking guide in Chongqing", 900], ["景点门票", "《重庆·1949》B区VIP票（4张）", "Chongqing 1949 Area B VIP tickets (4)", 1436]);
service("khoi-06", ["送站", "重庆送站", "Chongqing station drop-off", 390], ["接站", "西安接站", "Xi'an station pickup", 390]);
service("khoi-07", ["郊区用车", "西安9座兵马俑用车", "Xi'an Terracotta Warriors transfer (9-seat vehicle)", 720], ["多语言导游", "西安英语导游", "English-speaking guide in Xi'an", 900], ["景点门票", "兵马俑门票（4张）", "Terracotta Warriors tickets (4)", 480]);
service("khoi-08", ["送站", "西安送站", "Xi'an station drop-off", 390], ["接站", "北京接站", "Beijing station pickup", 520]);
service("khoi-09", ["市区用车", "北京9座市区用车", "Beijing city transfer (9-seat vehicle)", 1200], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1100], ["景点门票", "故宫门票（4张）", "Forbidden City tickets (4)", 360], ["景点门票", "天坛门票（1张）", "Temple of Heaven ticket (1)", 34], ["景点门票", "秦乐宫杂技蓝区票（4张）", "Qinlegong Acrobatics Blue Area tickets (4)", 840]);
service("khoi-10", ["郊区用车", "北京9座慕田峪用车", "Beijing–Mutianyu transfer (9-seat vehicle)", 1430], ["送机", "北京9座送机", "Beijing airport drop-off (9-seat vehicle)", 590], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1250], ["景点门票", "慕田峪长城套票（4张）", "Mutianyu Great Wall combo tickets (4)", 800]);
service("jasmine-01", ["郊区用车", "北京9座野生动物园用车", "Beijing Wildlife Park transfer (9-seat vehicle)", 1200], ["景点门票", "北京野生动物园门票（5张）", "Beijing Wildlife Park tickets (5)", 750]);
service("jasmine-02", ["市区用车", "北京9座市区用车", "Beijing city transfer (9-seat vehicle)", 1200], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1100], ["景点门票", "颐和园门票（5张）", "Summer Palace tickets (5)", 300], ["景点门票", "秦乐宫杂技紫区票（5张）", "Qinlegong Acrobatics Purple Area tickets (5)", 1650]);
service("martjin-00", ["郊区用车", "北京7座慕田峪及颐和园用车", "Mutianyu and Summer Palace transfer (7-seat vehicle)", 910], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1100], ["景点门票", "慕田峪长城套票（2张）", "Mutianyu Great Wall combo tickets (2)", 400], ["景点门票", "颐和园门票（2张）", "Summer Palace tickets (2)", 120]);
service("martjin-09", ["景点门票", "天门山A线套票（2张）", "Tianmen Mountain Route A combo tickets (2)", 640]);
service("martjin-10", ["景点门票", "张家界森林公园套票（2张）", "Zhangjiajie Forest Park combo tickets (2)", 864]);
service("martjin-11", ["景点门票", "张家界大峡谷套票（2张）", "Zhangjiajie Grand Canyon combo tickets (2)", 550], ["景点门票", "黄龙洞门票（2张）", "Huanglong Cave tickets (2)", 236]);
service("martjin-12", ["景点门票", "七星山飞拉达票（2张）", "Qixing Mountain Via Ferrata tickets (2)", 1560]);
service("jose-01", ["郊区用车", "成都至乐山5座用车", "Chengdu–Leshan transfer (5-seat vehicle)", 950], ["景点门票", "乐山大佛及摆渡车票（2张）", "Leshan Giant Buddha and shuttle tickets (2)", 200], ["景点门票", "东方佛都门票（2张）", "Oriental Buddha Capital tickets (2)", 160]);
service("soumya-01", ["接机", "北京7座接机", "Beijing airport pickup (7-seat vehicle)", 400]);
service("soumya-02", ["市区用车", "北京7座市区用车", "Beijing city transfer (7-seat vehicle)", 780], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1100], ["景点门票", "故宫门票（2张）", "Forbidden City tickets (2)", 180]);
service("soumya-03", ["郊区用车", "北京至慕田峪7座用车", "Beijing–Mutianyu transfer (7-seat vehicle)", 845], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1250], ["景点门票", "慕田峪长城套票（2张）", "Mutianyu Great Wall combo tickets (2)", 400]);
service("soumya-04", ["市区用车", "北京7座市区用车", "Beijing city transfer (7-seat vehicle)", 780], ["送站", "北京7座送站", "Beijing station drop-off (7-seat vehicle)", 260], ["接站", "西安7座接站", "Xi'an station pickup (7-seat vehicle)", 260], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1100], ["景点门票", "颐和园门票（2张）", "Summer Palace tickets (2)", 120]);
service("soumya-05", ["郊区用车", "西安7座兵马俑用车", "Xi'an Terracotta Warriors transfer (7-seat vehicle)", 550], ["多语言导游", "西安英语导游", "English-speaking guide in Xi'an", 850], ["景点门票", "兵马俑及丽山园门票（2张）", "Terracotta Warriors and Lishan Garden tickets (2)", 240]);
service("soumya-06", ["市区用车", "西安7座市区用车", "Xi'an city transfer (7-seat vehicle)", 550], ["多语言导游", "西安英语导游", "English-speaking guide in Xi'an", 900], ["景点门票", "大慈恩寺门票（2张）", "Daci'en Temple tickets (2)", 20]);
service("soumya-07", ["送站", "西安7座送站", "Xi'an station drop-off (7-seat vehicle)", 260], ["接站", "成都7座接站", "Chengdu station pickup (7-seat vehicle)", 200]);
service("soumya-08", ["郊区用车", "成都7座熊猫谷及都江堰用车", "Panda Valley and Dujiangyan transfer (7-seat vehicle)", 980], ["多语言导游", "成都英语导游", "English-speaking guide in Chengdu", 900], ["景点门票", "熊猫谷门票（2张）", "Panda Valley tickets (2)", 110], ["景点门票", "都江堰门票（2张）", "Dujiangyan tickets (2)", 160]);
service("soumya-09", ["郊区用车", "成都至乐山7座用车", "Chengdu–Leshan transfer (7-seat vehicle)", 1180], ["多语言导游", "成都英语导游", "English-speaking guide in Chengdu", 1000], ["景点门票", "乐山大佛、摆渡车及游船票（2张）", "Leshan Giant Buddha, shuttle and cruise tickets (2)", 320], ["景点门票", "东方佛都门票（2张）", "Oriental Buddha Capital tickets (2)", 160]);
service("soumya-10", ["送站", "成都7座送站", "Chengdu station drop-off (7-seat vehicle)", 200], ["接站", "重庆7座接站", "Chongqing station pickup (7-seat vehicle)", 200]);
service("soumya-11", ["市区用车", "重庆7座市区用车", "Chongqing city transfer (7-seat vehicle)", 850], ["多语言导游", "重庆英语导游", "English-speaking guide in Chongqing", 900]);
service("soumya-12", ["市区用车", "重庆7座市区用车", "Chongqing city transfer (7-seat vehicle)", 850], ["多语言导游", "重庆英语导游", "English-speaking guide in Chongqing", 900], ["景点门票", "《重庆·1949》C区VIP票（2张）", "Chongqing 1949 Area C VIP tickets (2)", 1198]);
service("soumya-13", ["送站", "重庆7座送站", "Chongqing station drop-off (7-seat vehicle)", 200], ["接站", "桂林7座接站", "Guilin station pickup (7-seat vehicle)", 200]);
service("soumya-14", ["郊区用车", "桂林7座漓江用车", "Guilin Li River transfer (7-seat vehicle)", 910], ["游船", "四星漓江游船票（2张）", "Four-star Li River Cruise tickets (2)", 720]);
service("soumya-15", ["郊区用车", "阳朔7座用车", "Yangshuo transfer (7-seat vehicle)", 910], ["多语言导游", "阳朔英语导游", "English-speaking guide in Yangshuo", 900]);
service("soumya-16", ["送机", "桂林7座送机", "Guilin airport drop-off (7-seat vehicle)", 520], ["接机", "上海7座接机", "Shanghai airport pickup (7-seat vehicle)", 390]);
service("soumya-17", ["郊区用车", "上海至乌镇7座用车", "Shanghai–Wuzhen transfer (7-seat vehicle)", 1820], ["多语言导游", "乌镇英语导游", "English-speaking guide in Wuzhen", 1250], ["景点门票", "乌镇西栅门票（2张）", "Wuzhen Xizha tickets (2)", 300]);
service("soumya-18", ["郊区用车", "上海迪士尼7座往返用车", "Shanghai Disneyland round-trip transfer (7-seat vehicle)", 720]);
service("soumya-19", ["郊区用车", "上海海昌海洋公园7座往返用车", "Shanghai Haichang Ocean Park round-trip transfer (7-seat vehicle)", 1300], ["景点门票", "海昌海洋公园成人票（2张）", "Haichang Ocean Park adult tickets (2)", 798], ["景点门票", "海昌海洋公园儿童票（2张）", "Haichang Ocean Park child tickets (2)", 558]);
service("soumya-20", ["市区用车", "上海7座市区用车", "Shanghai city transfer (7-seat vehicle)", 900], ["多语言导游", "上海英语导游", "English-speaking guide in Shanghai", 1100], ["景点门票", "豫园门票（2张）", "Yu Garden tickets (2)", 80], ["自定义项目", "汉服妆造体验（4份）", "Hanfu makeup and hairstyle experience (4)", 2392]);
service("soumya-21", ["送机", "上海7座送机", "Shanghai airport drop-off (7-seat vehicle)", 390]);
service("penny-01", ["接机", "张家界7座接机", "Zhangjiajie airport pickup (7-seat vehicle)", 200]);
service("penny-02", ["郊区用车", "张家界至茅岩河7座用车", "Zhangjiajie–Maoyan River transfer (7-seat vehicle)", 390], ["景点门票", "茅岩河机动漂流票（2张）", "Maoyan River motorized rafting tickets (2)", 696]);
service("penny-03", ["郊区用车", "七星山及天门山7座用车", "Qixing and Tianmen Mountain transfer (7-seat vehicle)", 460], ["多语言导游", "张家界英语导游", "English-speaking guide in Zhangjiajie", 900], ["景点门票", "七星山飞拉达票（2张）", "Qixing Mountain Via Ferrata tickets (2)", 1560], ["景点门票", "天门山A线套票（2张）", "Tianmen Mountain Route A combo tickets (2)", 640]);
service("penny-04", ["郊区用车", "大峡谷及黄龙洞7座用车", "Grand Canyon and Huanglong Cave transfer (7-seat vehicle)", 780], ["多语言导游", "张家界英语导游", "English-speaking guide in Zhangjiajie", 900], ["景点门票", "张家界大峡谷套票（2张）", "Zhangjiajie Grand Canyon combo tickets (2)", 550], ["景点门票", "黄龙洞门票（2张）", "Huanglong Cave tickets (2)", 236]);
service("penny-05", ["送机", "张家界7座送机", "Zhangjiajie airport drop-off (7-seat vehicle)", 200]);
service("mitra-01", ["接机", "北京7座接机", "Beijing airport pickup (7-seat vehicle)", 400]);
service("mitra-02", ["市区用车", "北京7座市区用车", "Beijing city transfer (7-seat vehicle)", 780], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1100], ["景点门票", "故宫门票（2张）", "Forbidden City tickets (2)", 180]);
service("mitra-03", ["郊区用车", "慕田峪及颐和园7座用车", "Mutianyu and Summer Palace transfer (7-seat vehicle)", 1050], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1250], ["景点门票", "慕田峪长城套票（2张）", "Mutianyu Great Wall combo tickets (2)", 400], ["景点门票", "颐和园门票（2张）", "Summer Palace tickets (2)", 120]);
service("mitra-04", ["市区用车", "北京7座市区用车", "Beijing city transfer (7-seat vehicle)", 850], ["送站", "北京7座送站", "Beijing station drop-off (7-seat vehicle)", 260], ["接站", "西安7座接站", "Xi'an station pickup (7-seat vehicle)", 260], ["多语言导游", "北京英语导游", "English-speaking guide in Beijing", 1100], ["景点门票", "天坛门票（2张）", "Temple of Heaven tickets (2)", 68]);
service("mitra-05", ["郊区用车", "西安7座兵马俑及华清宫用车", "Terracotta Warriors and Huaqing transfer (7-seat vehicle)", 780], ["多语言导游", "西安英语导游", "English-speaking guide in Xi'an", 900], ["景点门票", "兵马俑门票（2张）", "Terracotta Warriors tickets (2)", 240], ["景点门票", "华清宫门票（2张）", "Huaqing Palace tickets (2)", 240]);
service("mitra-06", ["市区用车", "西安7座市区用车", "Xi'an city transfer (7-seat vehicle)", 650], ["送站", "西安7座送站", "Xi'an station drop-off (7-seat vehicle)", 260], ["接站", "重庆7座接站", "Chongqing station pickup (7-seat vehicle)", 200], ["多语言导游", "西安英语导游", "English-speaking guide in Xi'an", 900], ["景点门票", "大慈恩寺门票（2张）", "Daci'en Temple tickets (2)", 20], ["景点门票", "西安清真大寺门票（2张）", "Great Mosque of Xi'an tickets (2)", 50]);
service("mitra-07", ["市区用车", "重庆7座市区用车", "Chongqing city transfer (7-seat vehicle)", 850], ["多语言导游", "重庆英语导游", "English-speaking guide in Chongqing", 900], ["景点门票", "《重庆·1949》A区VIP票（2张）", "Chongqing 1949 Area A VIP tickets (2)", 718], ["景点门票", "罗汉寺门票（2张）", "Luohan Temple tickets (2)", 40]);
service("mitra-08", ["市区用车", "重庆5座市区用车", "Chongqing city transfer (5-seat vehicle)", 910], ["多语言导游", "重庆英语导游", "English-speaking guide in Chongqing", 1050], ["景点门票", "重庆动物园及熊猫馆票（2张）", "Chongqing Zoo and Panda Pavilion tickets (2)", 140], ["缆车", "长江索道票（2张）", "Yangtze River Cableway tickets (2)", 60], ["游船", "两江夜游船票（2张）", "Two Rivers Night Cruise tickets (2)", 336]);
service("mitra-09", ["郊区用车", "重庆至大足7座用车", "Chongqing–Dazu transfer (7-seat vehicle)", 1200], ["多语言导游", "重庆英语导游", "English-speaking guide in Chongqing", 1050], ["景点门票", "大足石刻老年票（1张）", "Dazu Rock Carvings senior ticket (1)", 68]);
service("mitra-10", ["接站", "张家界7座接站", "Zhangjiajie station pickup (7-seat vehicle)", 200], ["市区用车", "张家界七十二奇楼至酒店用车", "Zhangjiajie 72 Qilou–hotel transfer", 200], ["郊区用车", "重庆至武隆7座用车及送站", "Chongqing–Wulong transfer and station drop-off (7-seat vehicle)", 1300], ["多语言导游", "重庆英语导游", "English-speaking guide in Chongqing", 1000], ["景点门票", "天生三桥及龙水峡地缝老年套票（2张）", "Three Natural Bridges and Longshuixia senior combo tickets (2)", 270]);
service("mitra-11", ["郊区用车", "张家界森林公园7座往返用车", "Zhangjiajie Forest Park round-trip transfer (7-seat vehicle)", 390], ["多语言导游", "张家界英语导游", "English-speaking guide in Zhangjiajie", 900], ["景点门票", "张家界森林公园老年套票（2张）", "Zhangjiajie Forest Park senior combo tickets (2)", 547]);
service("mitra-12", ["郊区用车", "天门山及宝峰湖7座用车", "Tianmen Mountain and Baofeng Lake transfer (7-seat vehicle)", 590], ["多语言导游", "张家界英语导游", "English-speaking guide in Zhangjiajie", 900], ["景点门票", "天门山老年票（2张）", "Tianmen Mountain senior tickets (2)", 332], ["景点门票", "宝峰湖老年票（2张）", "Baofeng Lake senior tickets (2)", 160]);
service("mitra-13", ["郊区用车", "大峡谷及黄龙洞7座用车", "Grand Canyon and Huanglong Cave transfer (7-seat vehicle)", 520], ["郊区用车", "张家界至芙蓉镇7座用车", "Zhangjiajie–Furong transfer (7-seat vehicle)", 1050], ["多语言导游", "张家界英语导游", "English-speaking guide in Zhangjiajie", 1000], ["景点门票", "张家界大峡谷老年套票（2张）", "Zhangjiajie Grand Canyon senior combo tickets (2)", 422], ["景点门票", "黄龙洞门票（2张）", "Huanglong Cave tickets (2)", 236], ["景点门票", "芙蓉镇门票（2张）", "Furong Town tickets (2)", 200]);
service("mitra-14", ["送站", "芙蓉镇7座送站", "Furong station drop-off (7-seat vehicle)", 200], ["接站", "桂林7座接站", "Guilin station pickup (7-seat vehicle)", 200], ["多语言导游", "芙蓉镇英语导游", "English-speaking guide in Furong", 1000], ["景点门票", "芙蓉镇门票（2张）", "Furong Town tickets (2)", 200]);
service("mitra-15", ["郊区用车", "桂林至阳朔7座用车", "Guilin–Yangshuo transfer (7-seat vehicle)", 910], ["多语言导游", "阳朔英语导游", "English-speaking guide in Yangshuo", 910], ["游船", "四星漓江游船豪华商务舱票（2张）", "Four-star Li River Cruise luxury business tickets (2)", 720], ["缆车", "如意峰老年票及往返索道（2张）", "Ruyi Peak senior admission and cableway tickets (2)", 220]);
service("mitra-16", ["郊区用车", "阳朔7座市区用车", "Yangshuo transfer (7-seat vehicle)", 910], ["郊区用车", "阳朔至桂林7座用车", "Yangshuo–Guilin transfer (7-seat vehicle)", 520], ["多语言导游", "阳朔英语导游", "English-speaking guide in Yangshuo", 910], ["景点门票", "遇龙河竹筏票（1张含2人）", "Yulong River bamboo raft ticket (1, for 2 people)", 370]);
service("mitra-17", ["送机", "桂林7座送机", "Guilin airport drop-off (7-seat vehicle)", 260], ["接机", "上海7座接机", "Shanghai airport pickup (7-seat vehicle)", 390], ["郊区用车", "上海静安寺、朱家角及外滩7座用车", "Shanghai Jing'an, Zhujiajiao and Bund transfer (7-seat vehicle)", 1200], ["多语言导游", "上海英语导游（10小时）", "English-speaking guide in Shanghai (10 hours)", 1550], ["景点门票", "朱家角手摇船票（2张）", "Zhujiajiao hand-rowed boat tickets (2)", 400], ["景点门票", "静安寺门票（2张）", "Jing'an Temple tickets (2)", 100], ["游船", "黄浦江游船票（2张）", "Huangpu River Cruise tickets (2)", 300]);
service("mitra-18", ["郊区用车", "上海至苏州7座往返用车", "Shanghai–Suzhou round-trip transfer (7-seat vehicle)", 1700], ["多语言导游", "苏州英语导游（10小时）", "English-speaking guide in Suzhou (10 hours)", 1200], ["景点门票", "拙政园门票（2张）", "Humble Administrator's Garden tickets (2)", 160], ["景点门票", "同里古镇及游船套票（2张）", "Tongli Ancient Town and boat combo tickets (2)", 500]);
service("mitra-19", ["市区用车", "上海7座市区用车", "Shanghai city transfer (7-seat vehicle)", 750], ["送机", "上海7座送机", "Shanghai airport drop-off (7-seat vehicle)", 390], ["多语言导游", "上海英语导游", "English-speaking guide in Shanghai", 1100], ["景点门票", "豫园门票（2张）", "Yu Garden tickets (2)", 80]);
const addInvoiceExtras = (dayIds: string[], insurance: number, serviceFee: number) => {
    dayIds.forEach((dayId) => {
        servicesByDay[dayId]?.push({ category: "保险", nameZh: "发票旅游保险", nameEn: "Travel insurance", quotePrice: insurance }, { category: "服务费", nameZh: "发票行程服务费", nameEn: "Tour service fee", quotePrice: serviceFee });
    });
};
addInvoiceExtras(Array.from({ length: 10 }, (_, index) => `khoi-${String(index + 1).padStart(2, "0")}`), 40, 60);
addInvoiceExtras(["jasmine-01", "jasmine-02"], 50, 150);
addInvoiceExtras(["martjin-00", "martjin-09", "martjin-10", "martjin-11", "martjin-12"], 20, 20);
addInvoiceExtras(["jose-01"], 20, 60);
addInvoiceExtras(Array.from({ length: 21 }, (_, index) => `soumya-${String(index + 1).padStart(2, "0")}`), 20, 40);
addInvoiceExtras(Array.from({ length: 5 }, (_, index) => `penny-${String(index + 1).padStart(2, "0")}`), 20, 40);
addInvoiceExtras(Array.from({ length: 19 }, (_, index) => `mitra-${String(index + 1).padStart(2, "0")}`), 20, 60);
const productId = (dayId: string, index: number) => `import-service-${dayId}-${index}`;
export const importedProducts: PriceProduct[] = days.flatMap((day) => (servicesByDay[day.id] ?? []).map((item, index) => ({
    id: productId(day.id, index),
    city: day.city,
    category: item.category,
    nameZh: item.nameZh,
    nameEn: item.nameEn,
    costPrice: 0,
    quotePrice: item.quotePrice,
    unit: "固定总价",
    enabled: true,
})));
export const importedTemplates: RouteTemplate[] = days.map((day) => ({
    id: `import-template-${day.id}`,
    city: day.city,
    type: day.type,
    titleZh: day.titleZh,
    titleEn: day.titleEn,
    routeZh: day.routeZh,
    routeEn: day.routeEn,
    requiresVehicle: false,
    requiresGuide: false,
    linkedProductIds: (servicesByDay[day.id] ?? []).map((_, index) => productId(day.id, index)),
    includedEn: Array.from(new Set((servicesByDay[day.id] ?? []).map((item) => item.nameEn))),
}));
