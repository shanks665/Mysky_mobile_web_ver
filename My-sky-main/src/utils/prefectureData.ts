// 日本の都道府県データ

export interface Prefecture {
  id: string;
  name: string;
  cities: City[];
}

export interface City {
  id: string;
  name: string;
}

export const PREFECTURES: Prefecture[] = [
  {
    id: 'hokkaido',
    name: '北海道',
    cities: [
      { id: 'sapporo', name: '札幌市' },
      { id: 'hakodate', name: '函館市' },
      { id: 'asahikawa', name: '旭川市' },
      { id: 'other_hokkaido', name: 'その他' },
    ],
  },
  {
    id: 'aomori',
    name: '青森県',
    cities: [
      { id: 'aomori_city', name: '青森市' },
      { id: 'hirosaki', name: '弘前市' },
      { id: 'other_aomori', name: 'その他' },
    ],
  },
  {
    id: 'iwate',
    name: '岩手県',
    cities: [
      { id: 'morioka', name: '盛岡市' },
      { id: 'other_iwate', name: 'その他' },
    ],
  },
  {
    id: 'miyagi',
    name: '宮城県',
    cities: [
      { id: 'sendai', name: '仙台市' },
      { id: 'other_miyagi', name: 'その他' },
    ],
  },
  {
    id: 'akita',
    name: '秋田県',
    cities: [
      { id: 'akita_city', name: '秋田市' },
      { id: 'other_akita', name: 'その他' },
    ],
  },
  {
    id: 'yamagata',
    name: '山形県',
    cities: [
      { id: 'yamagata_city', name: '山形市' },
      { id: 'other_yamagata', name: 'その他' },
    ],
  },
  {
    id: 'fukushima',
    name: '福島県',
    cities: [
      { id: 'fukushima_city', name: '福島市' },
      { id: 'other_fukushima', name: 'その他' },
    ],
  },
  {
    id: 'ibaraki',
    name: '茨城県',
    cities: [
      { id: 'mito', name: '水戸市' },
      { id: 'tsukuba', name: 'つくば市' },
      { id: 'other_ibaraki', name: 'その他' },
    ],
  },
  {
    id: 'tochigi',
    name: '栃木県',
    cities: [
      { id: 'utsunomiya', name: '宇都宮市' },
      { id: 'other_tochigi', name: 'その他' },
    ],
  },
  {
    id: 'gunma',
    name: '群馬県',
    cities: [
      { id: 'maebashi', name: '前橋市' },
      { id: 'other_gunma', name: 'その他' },
    ],
  },
  {
    id: 'saitama',
    name: '埼玉県',
    cities: [
      { id: 'saitama_city', name: 'さいたま市' },
      { id: 'kawagoe', name: '川越市' },
      { id: 'other_saitama', name: 'その他' },
    ],
  },
  {
    id: 'chiba',
    name: '千葉県',
    cities: [
      { id: 'chiba_city', name: '千葉市' },
      { id: 'funabashi', name: '船橋市' },
      { id: 'other_chiba', name: 'その他' },
    ],
  },
  {
    id: 'tokyo',
    name: '東京都',
    cities: [
      { id: 'chiyoda', name: '千代田区' },
      { id: 'chuo', name: '中央区' },
      { id: 'minato', name: '港区' },
      { id: 'shinjuku', name: '新宿区' },
      { id: 'bunkyo', name: '文京区' },
      { id: 'taito', name: '台東区' },
      { id: 'sumida', name: '墨田区' },
      { id: 'koto', name: '江東区' },
      { id: 'shinagawa', name: '品川区' },
      { id: 'meguro', name: '目黒区' },
      { id: 'ota', name: '大田区' },
      { id: 'setagaya', name: '世田谷区' },
      { id: 'shibuya', name: '渋谷区' },
      { id: 'nakano', name: '中野区' },
      { id: 'suginami', name: '杉並区' },
      { id: 'toshima', name: '豊島区' },
      { id: 'kita', name: '北区' },
      { id: 'arakawa', name: '荒川区' },
      { id: 'itabashi', name: '板橋区' },
      { id: 'nerima', name: '練馬区' },
      { id: 'adachi', name: '足立区' },
      { id: 'katsushika', name: '葛飾区' },
      { id: 'edogawa', name: '江戸川区' },
      { id: 'hachioji', name: '八王子市' },
      { id: 'tachikawa', name: '立川市' },
      { id: 'other_tokyo', name: 'その他' },
    ],
  },
  {
    id: 'kanagawa',
    name: '神奈川県',
    cities: [
      { id: 'yokohama', name: '横浜市' },
      { id: 'kawasaki', name: '川崎市' },
      { id: 'sagamihara', name: '相模原市' },
      { id: 'other_kanagawa', name: 'その他' },
    ],
  },
  {
    id: 'niigata',
    name: '新潟県',
    cities: [
      { id: 'niigata_city', name: '新潟市' },
      { id: 'other_niigata', name: 'その他' },
    ],
  },
  {
    id: 'toyama',
    name: '富山県',
    cities: [
      { id: 'toyama_city', name: '富山市' },
      { id: 'other_toyama', name: 'その他' },
    ],
  },
  {
    id: 'ishikawa',
    name: '石川県',
    cities: [
      { id: 'kanazawa', name: '金沢市' },
      { id: 'other_ishikawa', name: 'その他' },
    ],
  },
  {
    id: 'fukui',
    name: '福井県',
    cities: [
      { id: 'fukui_city', name: '福井市' },
      { id: 'other_fukui', name: 'その他' },
    ],
  },
  {
    id: 'yamanashi',
    name: '山梨県',
    cities: [
      { id: 'kofu', name: '甲府市' },
      { id: 'other_yamanashi', name: 'その他' },
    ],
  },
  {
    id: 'nagano',
    name: '長野県',
    cities: [
      { id: 'nagano_city', name: '長野市' },
      { id: 'matsumoto', name: '松本市' },
      { id: 'other_nagano', name: 'その他' },
    ],
  },
  {
    id: 'gifu',
    name: '岐阜県',
    cities: [
      { id: 'gifu_city', name: '岐阜市' },
      { id: 'other_gifu', name: 'その他' },
    ],
  },
  {
    id: 'shizuoka',
    name: '静岡県',
    cities: [
      { id: 'shizuoka_city', name: '静岡市' },
      { id: 'hamamatsu', name: '浜松市' },
      { id: 'other_shizuoka', name: 'その他' },
    ],
  },
  {
    id: 'aichi',
    name: '愛知県',
    cities: [
      { id: 'nagoya', name: '名古屋市' },
      { id: 'toyota', name: '豊田市' },
      { id: 'other_aichi', name: 'その他' },
    ],
  },
  {
    id: 'mie',
    name: '三重県',
    cities: [
      { id: 'tsu', name: '津市' },
      { id: 'other_mie', name: 'その他' },
    ],
  },
  {
    id: 'shiga',
    name: '滋賀県',
    cities: [
      { id: 'otsu', name: '大津市' },
      { id: 'other_shiga', name: 'その他' },
    ],
  },
  {
    id: 'kyoto',
    name: '京都府',
    cities: [
      { id: 'kyoto_city', name: '京都市' },
      { id: 'other_kyoto', name: 'その他' },
    ],
  },
  {
    id: 'osaka',
    name: '大阪府',
    cities: [
      { id: 'osaka_city', name: '大阪市' },
      { id: 'sakai', name: '堺市' },
      { id: 'other_osaka', name: 'その他' },
    ],
  },
  {
    id: 'hyogo',
    name: '兵庫県',
    cities: [
      { id: 'kobe', name: '神戸市' },
      { id: 'himeji', name: '姫路市' },
      { id: 'other_hyogo', name: 'その他' },
    ],
  },
  {
    id: 'nara',
    name: '奈良県',
    cities: [
      { id: 'nara_city', name: '奈良市' },
      { id: 'other_nara', name: 'その他' },
    ],
  },
  {
    id: 'wakayama',
    name: '和歌山県',
    cities: [
      { id: 'wakayama_city', name: '和歌山市' },
      { id: 'other_wakayama', name: 'その他' },
    ],
  },
  {
    id: 'tottori',
    name: '鳥取県',
    cities: [
      { id: 'tottori_city', name: '鳥取市' },
      { id: 'other_tottori', name: 'その他' },
    ],
  },
  {
    id: 'shimane',
    name: '島根県',
    cities: [
      { id: 'matsue', name: '松江市' },
      { id: 'other_shimane', name: 'その他' },
    ],
  },
  {
    id: 'okayama',
    name: '岡山県',
    cities: [
      { id: 'okayama_city', name: '岡山市' },
      { id: 'other_okayama', name: 'その他' },
    ],
  },
  {
    id: 'hiroshima',
    name: '広島県',
    cities: [
      { id: 'hiroshima_city', name: '広島市' },
      { id: 'other_hiroshima', name: 'その他' },
    ],
  },
  {
    id: 'yamaguchi',
    name: '山口県',
    cities: [
      { id: 'yamaguchi_city', name: '山口市' },
      { id: 'other_yamaguchi', name: 'その他' },
    ],
  },
  {
    id: 'tokushima',
    name: '徳島県',
    cities: [
      { id: 'tokushima_city', name: '徳島市' },
      { id: 'other_tokushima', name: 'その他' },
    ],
  },
  {
    id: 'kagawa',
    name: '香川県',
    cities: [
      { id: 'takamatsu', name: '高松市' },
      { id: 'other_kagawa', name: 'その他' },
    ],
  },
  {
    id: 'ehime',
    name: '愛媛県',
    cities: [
      { id: 'matsuyama', name: '松山市' },
      { id: 'other_ehime', name: 'その他' },
    ],
  },
  {
    id: 'kochi',
    name: '高知県',
    cities: [
      { id: 'kochi_city', name: '高知市' },
      { id: 'other_kochi', name: 'その他' },
    ],
  },
  {
    id: 'fukuoka',
    name: '福岡県',
    cities: [
      { id: 'fukuoka_city', name: '福岡市' },
      { id: 'kitakyushu', name: '北九州市' },
      { id: 'other_fukuoka', name: 'その他' },
    ],
  },
  {
    id: 'saga',
    name: '佐賀県',
    cities: [
      { id: 'saga_city', name: '佐賀市' },
      { id: 'other_saga', name: 'その他' },
    ],
  },
  {
    id: 'nagasaki',
    name: '長崎県',
    cities: [
      { id: 'nagasaki_city', name: '長崎市' },
      { id: 'other_nagasaki', name: 'その他' },
    ],
  },
  {
    id: 'kumamoto',
    name: '熊本県',
    cities: [
      { id: 'kumamoto_city', name: '熊本市' },
      { id: 'other_kumamoto', name: 'その他' },
    ],
  },
  {
    id: 'oita',
    name: '大分県',
    cities: [
      { id: 'oita_city', name: '大分市' },
      { id: 'other_oita', name: 'その他' },
    ],
  },
  {
    id: 'miyazaki',
    name: '宮崎県',
    cities: [
      { id: 'miyazaki_city', name: '宮崎市' },
      { id: 'other_miyazaki', name: 'その他' },
    ],
  },
  {
    id: 'kagoshima',
    name: '鹿児島県',
    cities: [
      { id: 'kagoshima_city', name: '鹿児島市' },
      { id: 'other_kagoshima', name: 'その他' },
    ],
  },
  {
    id: 'okinawa',
    name: '沖縄県',
    cities: [
      { id: 'naha', name: '那覇市' },
      { id: 'other_okinawa', name: 'その他' },
    ],
  },
];

// 都道府県IDから都道府県データを取得する関数
export const getPrefectureById = (id: string): Prefecture | undefined => {
  return PREFECTURES.find(prefecture => prefecture.id === id);
};

// 都道府県IDと市区町村IDから市区町村データを取得する関数
export const getCityById = (prefectureId: string, cityId: string): City | undefined => {
  const prefecture = getPrefectureById(prefectureId);
  if (!prefecture) return undefined;
  return prefecture.cities.find(city => city.id === cityId);
};

// 都道府県IDと市区町村IDから「都道府県 市区町村」の形式で文字列を取得する関数
export const getLocationString = (prefectureId?: string, cityId?: string): string => {
  if (!prefectureId) return '';
  
  const prefecture = getPrefectureById(prefectureId);
  if (!prefecture) return '';
  
  if (!cityId) return prefecture.name;
  
  const city = getCityById(prefectureId, cityId);
  if (!city) return prefecture.name;
  
  return `${prefecture.name} ${city.name}`;
};
