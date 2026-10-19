// Dữ liệu: hệ, bảng khắc chế, chiêu thức, loài Pokémon, đội hình mẫu.
'use strict';

const TYPES = {
  normal:   { n: 'NORMAL',   c: '#a8a878' },
  fire:     { n: 'FIRE',     c: '#f08030' },
  water:    { n: 'WATER',    c: '#6890f0' },
  grass:    { n: 'GRASS',    c: '#58b848' },
  electric: { n: 'ELECTRIC', c: '#e8b820' },
  ice:      { n: 'ICE',      c: '#58c8d8' },
  fighting: { n: 'FIGHT',    c: '#c03028' },
  poison:   { n: 'POISON',   c: '#a040a0' },
  ground:   { n: 'GROUND',   c: '#d0a850' },
  flying:   { n: 'FLYING',   c: '#9080e8' },
  psychic:  { n: 'PSYCHIC',  c: '#f85888' },
  rock:     { n: 'ROCK',     c: '#b8a038' },
  ghost:    { n: 'GHOST',    c: '#705898' },
  dragon:   { n: 'DRAGON',   c: '#7038f8' },
  dark:     { n: 'DARK',     c: '#705848' },
  steel:    { n: 'STEEL',    c: '#a0a0c0' },
};

// CHART[hệ tấn công][hệ phòng thủ] = hệ số (mặc định 1)
const CHART = {
  normal:   { rock: .5, ghost: 0, steel: .5 },
  fire:     { grass: 2, ice: 2, steel: 2, fire: .5, water: .5, rock: .5, dragon: .5 },
  water:    { fire: 2, ground: 2, rock: 2, water: .5, grass: .5, dragon: .5 },
  grass:    { water: 2, ground: 2, rock: 2, fire: .5, grass: .5, poison: .5, flying: .5, dragon: .5, steel: .5 },
  electric: { water: 2, flying: 2, electric: .5, grass: .5, dragon: .5, ground: 0 },
  ice:      { grass: 2, ground: 2, flying: 2, dragon: 2, fire: .5, water: .5, ice: .5, steel: .5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: .5, flying: .5, psychic: .5, ghost: 0 },
  poison:   { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0 },
  ground:   { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: .5, flying: 0 },
  flying:   { grass: 2, fighting: 2, electric: .5, rock: .5, steel: .5 },
  psychic:  { fighting: 2, poison: 2, psychic: .5, steel: .5, dark: 0 },
  rock:     { fire: 2, ice: 2, flying: 2, fighting: .5, ground: .5, steel: .5 },
  ghost:    { psychic: 2, ghost: 2, dark: .5, normal: 0 },
  dragon:   { dragon: 2, steel: .5 },
  dark:     { psychic: 2, ghost: 2, fighting: .5, dark: .5 },
  steel:    { ice: 2, rock: 2, fire: .5, water: .5, electric: .5, steel: .5 },
};
function typeMult(atk, defTypes) {
  let m = 1;
  for (const d of defTypes) { const v = CHART[atk] && CHART[atk][d]; if (v !== undefined) m *= v; }
  return m;
}

// k (kiểu chiêu):
//  proj   – bắn đạn (count viên, spread rad), né được
//  beam   – gồng rồi phóng tia thẳng, né được nếu ra khỏi đường tia
//  strike – vòng cảnh báo tại chỗ mục tiêu, nổ sau delay giây
//  nova   – sóng lan quanh bản thân, bán kính rad
//  dash   – lao vào cận chiến
//  heal   – hồi amt * máu tối đa
// p = sức mạnh mỗi lần trúng, cd = hồi chiêu (giây), st = [trạng thái, tỉ lệ]
const MOVES = {
  thunderbolt:  { n: 'Thunderbolt',  t: 'electric', c: 'spec', p: 90,  cd: 2.4, k: 'proj', fx: 'bolt',   spd: 175, range: 150, st: ['par', .15] },
  thunder:      { n: 'Thunder',      t: 'electric', c: 'spec', p: 110, cd: 5.5, k: 'strike', fx: 'thunder', rad: 20, delay: .8, range: 170, st: ['par', .3] },
  quickattack:  { n: 'Quick Attack', t: 'normal',   c: 'phys', p: 45,  cd: 1.6, k: 'dash', fx: 'slash', range: 120, spd: 300 },
  irontail:     { n: 'Iron Tail',    t: 'steel',    c: 'phys', p: 100, cd: 3.2, k: 'dash', fx: 'slash', range: 90, spd: 240 },
  flamethrower: { n: 'Flamethrower', t: 'fire',     c: 'spec', p: 20,  cd: 2.6, k: 'proj', fx: 'fire',   spd: 140, range: 130, count: 5, interval: .06, spread: .1, st: ['brn', .04] },
  fireblast:    { n: 'Fire Blast',   t: 'fire',     c: 'spec', p: 110, cd: 5.5, k: 'strike', fx: 'blast', rad: 24, delay: .75, range: 160, st: ['brn', .3] },
  eruption:     { n: 'Eruption',     t: 'fire',     c: 'spec', p: 100, cd: 8,   k: 'nova', fx: 'eruption', rad: 62 },
  flamewheel:   { n: 'Flame Wheel',  t: 'fire',     c: 'phys', p: 70,  cd: 2.2, k: 'dash', fx: 'fire', range: 110, spd: 260, st: ['brn', .1] },
  airslash:     { n: 'Air Slash',    t: 'flying',   c: 'spec', p: 40,  cd: 2.2, k: 'proj', fx: 'air',    spd: 200, range: 140, count: 2, spread: .2 },
  dragonclaw:   { n: 'Dragon Claw',  t: 'dragon',   c: 'phys', p: 80,  cd: 2.4, k: 'dash', fx: 'claw', range: 100, spd: 250 },
  razorleaf:    { n: 'Razor Leaf',   t: 'grass',    c: 'phys', p: 25,  cd: 1.9, k: 'proj', fx: 'leaf',   spd: 165, range: 140, count: 3, spread: .28 },
  sludgebomb:   { n: 'Sludge Bomb',  t: 'poison',   c: 'spec', p: 90,  cd: 2.8, k: 'proj', fx: 'sludge', spd: 120, range: 140, st: ['psn', .3] },
  earthquake:   { n: 'Earthquake',   t: 'ground',   c: 'phys', p: 100, cd: 5.5, k: 'nova', fx: 'quake', rad: 72 },
  synthesis:    { n: 'Synthesis',    t: 'grass',    c: 'stat', p: 0,   cd: 14,  k: 'heal', amt: .3 },
  hydropump:    { n: 'Hydro Pump',   t: 'water',    c: 'spec', p: 110, cd: 4.5, k: 'beam', fx: 'water', range: 160, w: 9, charge: .45 },
  icebeam:      { n: 'Ice Beam',     t: 'ice',      c: 'spec', p: 90,  cd: 3.4, k: 'beam', fx: 'ice', range: 160, w: 6, charge: .35, st: ['frz', .12] },
  skullbash:    { n: 'Skull Bash',   t: 'normal',   c: 'phys', p: 95,  cd: 3,   k: 'dash', fx: 'slash', range: 100, spd: 230 },
  bodyslam:     { n: 'Body Slam',    t: 'normal',   c: 'phys', p: 85,  cd: 2.6, k: 'dash', fx: 'slam', range: 100, spd: 220, st: ['par', .25] },
  hyperbeam:    { n: 'Hyper Beam',   t: 'normal',   c: 'spec', p: 150, cd: 9,   k: 'beam', fx: 'hyper', range: 180, w: 13, charge: .8 },
  rest:         { n: 'Rest',         t: 'psychic',  c: 'stat', p: 0,   cd: 20,  k: 'heal', amt: .55, sleep: 2.2 },
  surf:         { n: 'Surf',         t: 'water',    c: 'spec', p: 90,  cd: 4.8, k: 'nova', fx: 'surf', rad: 70 },
  blizzard:     { n: 'Blizzard',     t: 'ice',      c: 'spec', p: 110, cd: 6,   k: 'strike', fx: 'blizzard', rad: 28, delay: .9, range: 170, st: ['frz', .2] },
  swift:        { n: 'Swift',        t: 'normal',   c: 'spec', p: 22,  cd: 1.7, k: 'proj', fx: 'star', spd: 150, range: 150, count: 3, spread: .35, homing: true },
  waterfall:    { n: 'Waterfall',    t: 'water',    c: 'phys', p: 80,  cd: 2.3, k: 'dash', fx: 'water', range: 110, spd: 260 },
  crunch:       { n: 'Crunch',       t: 'dark',     c: 'phys', p: 80,  cd: 2.3, k: 'dash', fx: 'bite', range: 100, spd: 250 },
  icepunch:     { n: 'Ice Punch',    t: 'ice',      c: 'phys', p: 75,  cd: 2.3, k: 'dash', fx: 'ice', range: 100, spd: 250, st: ['frz', .1] },
  dragonpulse:  { n: 'Dragon Pulse', t: 'dragon',   c: 'spec', p: 85,  cd: 2.6, k: 'proj', fx: 'dragon', spd: 135, range: 150 },
  powergem:     { n: 'Power Gem',    t: 'rock',     c: 'spec', p: 80,  cd: 2.3, k: 'proj', fx: 'gem', spd: 165, range: 150 },
  stoneedge:    { n: 'Stone Edge',   t: 'rock',     c: 'phys', p: 100, cd: 4,   k: 'strike', fx: 'rocks', rad: 20, delay: .6, range: 160 },
  psychic:      { n: 'Psychic',      t: 'psychic',  c: 'spec', p: 90,  cd: 2.7, k: 'strike', fx: 'psy', rad: 18, delay: .45, range: 170 },
  shadowball:   { n: 'Shadow Ball',  t: 'ghost',    c: 'spec', p: 80,  cd: 2.3, k: 'proj', fx: 'shadow', spd: 130, range: 150 },
  morningsun:   { n: 'Morning Sun',  t: 'normal',   c: 'stat', p: 0,   cd: 14,  k: 'heal', amt: .3 },
};

// base: [HP, Atk, Def, SpA, SpD, Spe] – chỉ số gốc thật của từng loài
const SPECIES = {
  pikachu:    { n: 'Pikachu',    t: ['electric'],         base: [35, 55, 40, 50, 50, 90],    item: 'lightball', moves: ['thunderbolt', 'quickattack', 'irontail', 'thunder'] },
  charizard:  { n: 'Charizard',  t: ['fire', 'flying'],   base: [78, 84, 78, 109, 85, 100],  item: 'charcoal',  moves: ['flamethrower', 'airslash', 'dragonclaw', 'earthquake'] },
  venusaur:   { n: 'Venusaur',   t: ['grass', 'poison'],  base: [80, 82, 83, 100, 100, 80],  item: 'leftovers', moves: ['razorleaf', 'sludgebomb', 'earthquake', 'synthesis'] },
  blastoise:  { n: 'Blastoise',  t: ['water'],            base: [79, 83, 100, 85, 105, 78],  item: 'mysticwater', moves: ['hydropump', 'icebeam', 'skullbash', 'surf'] },
  snorlax:    { n: 'Snorlax',    t: ['normal'],           base: [160, 110, 65, 65, 110, 30], item: 'leftovers', moves: ['bodyslam', 'earthquake', 'hyperbeam', 'rest'] },
  lapras:     { n: 'Lapras',     t: ['water', 'ice'],     base: [130, 85, 80, 85, 95, 60],   item: 'nevermeltice', moves: ['icebeam', 'surf', 'blizzard', 'thunderbolt'] },
  typhlosion: { n: 'Typhlosion', t: ['fire'],             base: [78, 84, 78, 109, 85, 100],  item: 'charcoal',  moves: ['flamethrower', 'flamewheel', 'eruption', 'swift'] },
  feraligatr: { n: 'Feraligatr', t: ['water'],            base: [85, 105, 100, 79, 83, 78],  item: 'mysticwater', moves: ['waterfall', 'crunch', 'icepunch', 'surf'] },
  meganium:   { n: 'Meganium',   t: ['grass'],            base: [80, 82, 100, 83, 100, 80],  item: 'leftovers', moves: ['razorleaf', 'bodyslam', 'earthquake', 'synthesis'] },
  ampharos:   { n: 'Ampharos',   t: ['electric'],         base: [90, 75, 85, 115, 90, 55],   item: 'magnet',    moves: ['thunderbolt', 'dragonpulse', 'powergem', 'thunder'] },
  tyranitar:  { n: 'Tyranitar',  t: ['rock', 'dark'],     base: [100, 134, 110, 95, 100, 61], item: 'leftovers', moves: ['stoneedge', 'crunch', 'earthquake', 'icebeam'] },
  espeon:     { n: 'Espeon',     t: ['psychic'],          base: [65, 65, 60, 130, 95, 110],  item: 'twistedspoon', moves: ['psychic', 'shadowball', 'swift', 'morningsun'] },
};

// Vật phẩm cầm tay
const ITEMS = {
  lightball:    { n: 'LIGHT BALL',  desc: 'Pikachu: Tấn công & Đặc công x2' },
  charcoal:     { n: 'CHARCOAL',    desc: 'Chiêu hệ Lửa +20%', boost: 'fire' },
  mysticwater:  { n: 'MYSTIC WATER', desc: 'Chiêu hệ Nước +20%', boost: 'water' },
  nevermeltice: { n: 'NEVERMELTICE', desc: 'Chiêu hệ Băng +20%', boost: 'ice' },
  magnet:       { n: 'MAGNET',      desc: 'Chiêu hệ Điện +20%', boost: 'electric' },
  twistedspoon: { n: 'TWISTEDSPOON', desc: 'Chiêu hệ Siêu Linh +20%', boost: 'psychic' },
  leftovers:    { n: 'LEFTOVERS',   desc: 'Hồi 1/16 máu mỗi 4 giây' },
  choiceband:   { n: 'CHOICE BAND', desc: 'Tấn công vật lý +50%' },
};

const STATUS = {
  par: { n: 'PAR', c: '#e8c020' },
  brn: { n: 'BRN', c: '#f06830' },
  frz: { n: 'FRZ', c: '#78d8f0' },
  psn: { n: 'PSN', c: '#a050c0' },
  slp: { n: 'SLP', c: '#9098b0' },
};

const TRAINERS = {
  red:  { n: 'RED',  team: ['pikachu', 'venusaur', 'charizard', 'blastoise', 'snorlax', 'lapras'] },
  gold: { n: 'GOLD', team: ['typhlosion', 'feraligatr', 'meganium', 'ampharos', 'tyranitar', 'espeon'] },
};

const LEVEL = 50;
const HP_SCALE = 3.2; // kéo dài trận đấu thời gian thực

function calcStats(base, item) {
  const hp = Math.floor(((2 * base[0] + 31) * LEVEL) / 100 + LEVEL + 10);
  const st = base.slice(1).map(b => Math.floor(((2 * b + 31) * LEVEL) / 100 + 5));
  const s = { hp: Math.round(hp * HP_SCALE), atk: st[0], def: st[1], spa: st[2], spd: st[3], spe: st[4] };
  if (item === 'lightball') { s.atk *= 2; s.spa *= 2; }
  if (item === 'choiceband') s.atk = Math.floor(s.atk * 1.5);
  return s;
}
