import type { Difficulty, Region, SponsorIndustry } from './types';

// Fictional world data. Every organisation, player and brand is invented.

export interface Nation { code: string; name: string; flag: string; first: string[]; last: string[]; cities: string[]; weight: number }

const EU_FIRST_FR = ['Lucas', 'Hugo', 'Théo', 'Nathan', 'Enzo', 'Maxime', 'Alexis', 'Kylian', 'Romain', 'Mathis', 'Yanis', 'Clément', 'Axel', 'Noah', 'Evan', 'Sacha'];
const EU_LAST_FR = ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Garnier', 'Rousseau', 'Fournier', 'Morel', 'Girard', 'Lefèvre', 'Mercier', 'Blanc', 'Chevalier', 'Perrin', 'Roux'];

export const NATIONS: Record<Region, Nation[]> = {
  EU: [
    { code: 'FR', name: 'France', flag: '🇫🇷', first: EU_FIRST_FR, last: EU_LAST_FR, cities: ['Paris', 'Lyon', 'Lille', 'Bordeaux'], weight: 5 },
    { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧', first: ['Jack', 'Oliver', 'Harry', 'George', 'Charlie', 'Alfie', 'Callum', 'Kieran', 'Lewis', 'Ryan', 'Jamie', 'Connor'], last: ['Smith', 'Taylor', 'Brown', 'Walker', 'Wright', 'Hughes', 'Edwards', 'Clarke', 'Hall', 'Wood', 'Turner', 'Price'], cities: ['London', 'Manchester', 'Leeds'], weight: 4 },
    { code: 'DE', name: 'Allemagne', flag: '🇩🇪', first: ['Lukas', 'Leon', 'Finn', 'Jonas', 'Felix', 'Niklas', 'Tim', 'Moritz', 'Jannik', 'Paul'], last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Becker', 'Hoffmann', 'Wagner', 'Koch', 'Richter'], cities: ['Berlin', 'Cologne', 'Hamburg'], weight: 3 },
    { code: 'ES', name: 'Espagne', flag: '🇪🇸', first: ['Pablo', 'Álvaro', 'Daniel', 'Adrián', 'Javier', 'Sergio', 'Iker', 'Marcos', 'Rubén', 'Diego'], last: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Ruiz', 'Gil'], cities: ['Madrid', 'Barcelona', 'Valencia'], weight: 3 },
    { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱', first: ['Daan', 'Sem', 'Bram', 'Thijs', 'Luuk', 'Jesse', 'Milan', 'Stijn'], last: ['de Jong', 'Jansen', 'de Vries', 'Bakker', 'Visser', 'Smit', 'Meijer', 'Mulder'], cities: ['Amsterdam', 'Rotterdam'], weight: 2 },
    { code: 'DK', name: 'Danemark', flag: '🇩🇰', first: ['Mikkel', 'Rasmus', 'Mads', 'Frederik', 'Oliver', 'Emil', 'Magnus'], last: ['Nielsen', 'Jensen', 'Hansen', 'Pedersen', 'Andersen', 'Larsen'], cities: ['Copenhagen', 'Aarhus'], weight: 1 },
    { code: 'PL', name: 'Pologne', flag: '🇵🇱', first: ['Jakub', 'Kacper', 'Szymon', 'Filip', 'Mateusz', 'Bartek'], last: ['Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Zieliński'], cities: ['Warsaw', 'Kraków'], weight: 1.5 },
    { code: 'BE', name: 'Belgique', flag: '🇧🇪', first: ['Arthur', 'Louis', 'Jules', 'Victor', 'Simon', 'Lars'], last: ['Peeters', 'Janssens', 'Maes', 'Dupont', 'Claes', 'Lambert'], cities: ['Brussels', 'Antwerp'], weight: 1 },
    { code: 'SE', name: 'Suède', flag: '🇸🇪', first: ['Erik', 'Oscar', 'Viktor', 'Elias', 'Anton', 'Isak'], last: ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Lindqvist'], cities: ['Stockholm', 'Gothenburg'], weight: 1 },
  ],
  NA: [
    { code: 'US', name: 'États-Unis', flag: '🇺🇸', first: ['Tyler', 'Jacob', 'Austin', 'Brandon', 'Caleb', 'Dylan', 'Ethan', 'Garrett', 'Hunter', 'Jayden', 'Kyle', 'Logan', 'Mason', 'Nolan', 'Owen', 'Trevor'], last: ['Johnson', 'Williams', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Young', 'King', 'Scott', 'Baker', 'Reed'], cities: ['Los Angeles', 'Dallas', 'Chicago', 'Atlanta', 'New York'], weight: 6 },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', first: ['Liam', 'William', 'Benjamin', 'Nathan', 'Samuel', 'Zachary', 'Félix'], last: ['Tremblay', 'Roy', 'Gagnon', 'Campbell', 'MacDonald', 'Côté', 'Stewart'], cities: ['Toronto', 'Montréal', 'Vancouver'], weight: 2 },
    { code: 'MX', name: 'Mexique', flag: '🇲🇽', first: ['Santiago', 'Emiliano', 'Mateo', 'Leonardo', 'Diego', 'Iván'], last: ['Hernández', 'González', 'Ramírez', 'Flores', 'Reyes', 'Cruz'], cities: ['Mexico City', 'Monterrey'], weight: 1 },
  ],
  SAM: [
    { code: 'BR', name: 'Brésil', flag: '🇧🇷', first: ['Gabriel', 'Lucas', 'Matheus', 'Pedro', 'Rafael', 'Guilherme', 'Felipe', 'Vinícius', 'Thiago', 'Caio', 'Bruno', 'Igor'], last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Carvalho', 'Ribeiro', 'Barbosa'], cities: ['São Paulo', 'Rio de Janeiro', 'Curitiba'], weight: 5 },
    { code: 'AR', name: 'Argentine', flag: '🇦🇷', first: ['Facundo', 'Joaquín', 'Tomás', 'Nicolás', 'Agustín', 'Franco'], last: ['González', 'Rodríguez', 'Gómez', 'Díaz', 'Álvarez', 'Benítez'], cities: ['Buenos Aires', 'Córdoba'], weight: 1.5 },
    { code: 'CL', name: 'Chili', flag: '🇨🇱', first: ['Benjamín', 'Vicente', 'Martín', 'Cristóbal', 'Ignacio'], last: ['Muñoz', 'Rojas', 'Soto', 'Contreras', 'Silva'], cities: ['Santiago'], weight: 1 },
  ],
  MENA: [
    { code: 'SA', name: 'Arabie saoudite', flag: '🇸🇦', first: ['Abdullah', 'Faisal', 'Khalid', 'Saud', 'Turki', 'Nawaf', 'Fahad', 'Rakan'], last: ['Al-Otaibi', 'Al-Qahtani', 'Al-Ghamdi', 'Al-Harbi', 'Al-Shehri', 'Al-Dosari', 'Al-Mutairi'], cities: ['Riyadh', 'Jeddah'], weight: 4 },
    { code: 'MA', name: 'Maroc', flag: '🇲🇦', first: ['Youssef', 'Mehdi', 'Amine', 'Hamza', 'Anas', 'Ilyas'], last: ['El Amrani', 'Benali', 'Tazi', 'Bennani', 'Alaoui', 'Idrissi'], cities: ['Casablanca', 'Rabat'], weight: 1.5 },
    { code: 'AE', name: 'Émirats arabes unis', flag: '🇦🇪', first: ['Mohammed', 'Rashid', 'Hamdan', 'Saeed', 'Majid'], last: ['Al-Mansouri', 'Al-Hammadi', 'Al-Nuaimi', 'Al-Ketbi'], cities: ['Dubai', 'Abu Dhabi'], weight: 1.5 },
    { code: 'EG', name: 'Égypte', flag: '🇪🇬', first: ['Omar', 'Karim', 'Mostafa', 'Ziad', 'Ali'], last: ['Hassan', 'Mahmoud', 'Ibrahim', 'Farouk', 'Saleh'], cities: ['Cairo'], weight: 1 },
  ],
  OCE: [
    { code: 'AU', name: 'Australie', flag: '🇦🇺', first: ['Jack', 'Cooper', 'Riley', 'Lachlan', 'Mitchell', 'Bailey', 'Harrison', 'Jake'], last: ['Thompson', 'Mitchell', 'Ryan', 'Kelly', 'Murphy', 'Campbell', 'Robinson', 'Bell'], cities: ['Sydney', 'Melbourne', 'Brisbane'], weight: 4 },
    { code: 'NZ', name: 'Nouvelle-Zélande', flag: '🇳🇿', first: ['Liam', 'Hamish', 'Nikau', 'Sam', 'Toby'], last: ['Wilson', 'Ngata', 'Parata', 'Fraser', 'Reid'], cities: ['Auckland', 'Wellington'], weight: 1.5 },
  ],
  APAC: [
    { code: 'JP', name: 'Japon', flag: '🇯🇵', first: ['Haruto', 'Sota', 'Yuto', 'Ren', 'Riku', 'Kaito', 'Daiki'], last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura'], cities: ['Tokyo', 'Osaka'], weight: 2.5 },
    { code: 'KR', name: 'Corée du Sud', flag: '🇰🇷', first: ['Min-jun', 'Seo-jun', 'Ji-ho', 'Hyun-woo', 'Do-yun'], last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung'], cities: ['Seoul', 'Busan'], weight: 1.5 },
    { code: 'SG', name: 'Singapour', flag: '🇸🇬', first: ['Wei Jie', 'Jun Hao', 'Darren', 'Marcus', 'Ryan'], last: ['Tan', 'Lim', 'Ng', 'Wong', 'Goh'], cities: ['Singapore'], weight: 1 },
    { code: 'TH', name: 'Thaïlande', flag: '🇹🇭', first: ['Krit', 'Nattapong', 'Thanakorn', 'Pakorn'], last: ['Saetang', 'Wongsakul', 'Chaiyaphum', 'Srisuk'], cities: ['Bangkok'], weight: 1 },
  ],
  SSA: [
    { code: 'ZA', name: 'Afrique du Sud', flag: '🇿🇦', first: ['Thabo', 'Sipho', 'Liam', 'Ethan', 'Kagiso', 'Bongani', 'Tristan', 'Keegan'], last: ['Naidoo', 'van der Merwe', 'Dlamini', 'Botha', 'Nkosi', 'Pillay', 'Mokoena'], cities: ['Johannesburg', 'Cape Town', 'Durban'], weight: 5 },
    { code: 'NG', name: 'Nigeria', flag: '🇳🇬', first: ['Chinedu', 'Tobi', 'Emeka', 'Kelechi', 'Femi'], last: ['Okafor', 'Adeyemi', 'Eze', 'Balogun', 'Okonkwo'], cities: ['Lagos'], weight: 1 },
    { code: 'KE', name: 'Kenya', flag: '🇰🇪', first: ['Brian', 'Kevin', 'Dennis', 'Wanjiru', 'Otieno'], last: ['Mwangi', 'Kamau', 'Odhiambo', 'Kiptoo', 'Njoroge'], cities: ['Nairobi'], weight: 0.7 },
  ],
};

export const NATION_BY_CODE: Record<string, Nation & { region: Region }> = {};
for (const r of Object.keys(NATIONS) as Region[]) for (const n of NATIONS[r]) NATION_BY_CODE[n.code] = { ...n, region: r };
export const flag = (code: string) => NATION_BY_CODE[code]?.flag ?? '🏳️';

export const REGION_INFO: Record<Region, { name: string; strength: number; teams: number; prizeMult: number; majorSlots: number; color: string }> = {
  EU:   { name: 'Europe', strength: 1.0, teams: 16, prizeMult: 1.0, majorSlots: 5, color: '#4f8cff' },
  NA:   { name: 'Amérique du Nord', strength: 0.98, teams: 16, prizeMult: 1.0, majorSlots: 4, color: '#ff5a5a' },
  SAM:  { name: 'Amérique du Sud', strength: 0.92, teams: 16, prizeMult: 0.45, majorSlots: 2, color: '#3fcf8e' },
  MENA: { name: 'MENA', strength: 0.9, teams: 16, prizeMult: 0.55, majorSlots: 2, color: '#e8b04a' },
  OCE:  { name: 'Océanie', strength: 0.86, teams: 16, prizeMult: 0.35, majorSlots: 1, color: '#36c5d8' },
  APAC: { name: 'Asie-Pacifique', strength: 0.82, teams: 16, prizeMult: 0.35, majorSlots: 1, color: '#c77dff' },
  SSA:  { name: 'Afrique subsaharienne', strength: 0.8, teams: 16, prizeMult: 0.25, majorSlots: 1, color: '#ff8fab' },
};

// Gamertag building blocks
export const TAG_PARTS_A = ['Zen', 'Vat', 'Ark', 'Nyx', 'Kai', 'Rix', 'Sol', 'Vex', 'Oxy', 'Juno', 'Lux', 'Pyro', 'Hexa', 'Rho', 'Tiz', 'Mono', 'Fury', 'Skye', 'Drift', 'Echo', 'Flux', 'Gale', 'Halo', 'Ion', 'Jinx', 'Krypt', 'Lynx', 'Mav', 'Nova', 'Onyx', 'Pulse', 'Quill', 'Rogue', 'Seik', 'Tox', 'Umbra', 'Volt', 'Wisp', 'Xeno', 'Yuki', 'Zyph', 'Ace', 'Bolt', 'Cyan', 'Dash', 'Ember', 'Frost', 'Glitch', 'Hawk', 'Iris', 'Jolt', 'Kite', 'Loki', 'Mist', 'Neon', 'Orbit', 'Prism', 'Rift', 'Shade', 'Tempo'];
export const TAG_PARTS_B = ['', '', '', '', 'z', 'x', 'o', 'y', 'ix', 'ox', 'ii', 'RL', '7', 'ee', 'ka', 'eon', 'er', 'us', 'io', 'an', 'ic', 'ex'];
export const TAG_FULL = ['Kurai', 'Sparrow', 'Plume', 'Morrow', 'Tilt', 'Velvet', 'Hush', 'Static', 'Ripple', 'Saber', 'Cinder', 'Gravel', 'Marrow', 'Quartz', 'Rune', 'Sable', 'Thorn', 'Vapor', 'Wren', 'Alder', 'Bramble', 'Comet', 'Dusk', 'Fable', 'Gust', 'Harbor', 'Indigo', 'Jasper', 'Kestrel', 'Lumen', 'Mirth', 'Nimbus', 'Opal', 'Pebble', 'Quasar', 'Raven', 'Slate', 'Tundra', 'Umber', 'Vesper', 'Willow', 'Yonder', 'Zephyr', 'Atlas', 'Basil', 'Corvo', 'Dynamo', 'Fennec', 'Ghost', 'Hydra', 'Kraken', 'Mantis', 'Ozone', 'Panda', 'Riptide', 'Spectre', 'Turbo', 'Viper', 'Whiplash', 'Yeti'];

// Organisation name parts (all fictional)
export const ORG_PREFIX = ['Team', '', '', '', 'Club', '', ''];
export const ORG_WORDS = ['Vortex', 'Aurora', 'Helix', 'Nebula', 'Apex', 'Zenith', 'Phantom', 'Inferno', 'Titan', 'Valkyrie', 'Eclipse', 'Spectra', 'Monarch', 'Paragon', 'Odyssey', 'Vanguard', 'Catalyst', 'Ember', 'Solstice', 'Equinox', 'Horizon', 'Meridian', 'Polaris', 'Revenant', 'Sentinel', 'Tempest', 'Umbra', 'Vector', 'Wolfpack', 'Xenon', 'Arcadia', 'Bastion', 'Cobalt', 'Dynasty', 'Falcons', 'Griffin', 'Hydra', 'Ironclad', 'Juggernaut', 'Kinetic', 'Lumina', 'Mirage', 'Northstar', 'Obsidian', 'Pinnacle', 'Quantum', 'Rampage', 'Saber', 'Tidal', 'Uprising', 'Velocity', 'Warlords', 'Ascend', 'Blaze', 'Citadel', 'Drift', 'Elysium', 'Fortress', 'Gravity', 'Havoc', 'Impulse', 'Jaguar', 'Kraken', 'Legion', 'Mammoth', 'Nomads', 'Outlaws', 'Phoenix', 'Raptors', 'Stallions', 'Torque', 'Uproar', 'Valor', 'Wraith', 'Yokai', 'Zephyrs', 'Onyx', 'Ronin', 'Corsairs', 'Spartans', 'Comets', 'Typhoon', 'Banshee', 'Cyclone', 'Mustangs', 'Vipers', 'Wolves', 'Sharks', 'Pirates', 'Ravens', 'Hornets', 'Dragons', 'Knights', 'Lynx', 'Orcas', 'Pumas', 'Bears', 'Tigers', 'Eagles', 'Foxes', 'Owls', 'Cobras', 'Rhinos', 'Bisons', 'Coyotes', 'Panthers', 'Scorpions', 'Jackals', 'Hyenas', 'Mantas', 'Condors', 'Stingrays', 'Kodiaks', 'Lions', 'Gorillas', 'Wasps', 'Gators', 'Badgers', 'Hounds'];
export const ORG_SUFFIX = ['', '', '', 'Esports', 'Gaming', 'GG', 'Club', 'Collective', 'Esports', ''];
export const ORG_COLORS: [string, string][] = [
  ['#ff7a18', '#1a1a1a'], ['#3b82f6', '#0f172a'], ['#ef4444', '#111'], ['#22c55e', '#0b1f12'], ['#eab308', '#1c1917'],
  ['#a855f7', '#1e1033'], ['#06b6d4', '#082f35'], ['#f43f5e', '#200a10'], ['#e5e7eb', '#111827'], ['#14b8a6', '#042f2e'],
  ['#f97316', '#2a1205'], ['#6366f1', '#141433'], ['#84cc16', '#1a2e05'], ['#ec4899', '#2a0a1d'], ['#0ea5e9', '#0c2233'],
];

export const STAFF_FIRST = ['Alex', 'Sam', 'Chris', 'Jordan', 'Morgan', 'Robin', 'Taylor', 'Jamie', 'Charlie', 'Dominique', 'Camille', 'Max', 'Noa', 'Sacha', 'Kim', 'Ari', 'Dani', 'Eli', 'Rene', 'Toni'];

// Sponsor brands (fictional)
export const SPONSOR_SEED: { name: string; industry: SponsorIndustry; tier: number; regions: Region[] | 'GLOBAL'; audience: 'Hardcore' | 'Casual' | 'Mainstream' }[] = [
  { name: 'Kryon Peripherals', industry: 'Périphériques', tier: 5, regions: 'GLOBAL', audience: 'Hardcore' },
  { name: 'Synaptic Mice', industry: 'Périphériques', tier: 3, regions: ['EU', 'NA'], audience: 'Hardcore' },
  { name: 'Tactix Keys', industry: 'Périphériques', tier: 2, regions: 'GLOBAL', audience: 'Hardcore' },
  { name: 'VOLTA Energy', industry: 'Boisson énergisante', tier: 5, regions: 'GLOBAL', audience: 'Mainstream' },
  { name: 'Rush Hydra', industry: 'Boisson énergisante', tier: 3, regions: ['NA', 'SAM'], audience: 'Casual' },
  { name: 'Mamba Fuel', industry: 'Boisson énergisante', tier: 2, regions: ['EU', 'MENA'], audience: 'Casual' },
  { name: 'Throne Seating', industry: 'Chaises gaming', tier: 4, regions: 'GLOBAL', audience: 'Hardcore' },
  { name: 'Recline Pro', industry: 'Chaises gaming', tier: 2, regions: ['EU', 'OCE'], audience: 'Casual' },
  { name: 'Orbitel', industry: 'Tech', tier: 5, regions: 'GLOBAL', audience: 'Mainstream' },
  { name: 'Lumen Displays', industry: 'Tech', tier: 3, regions: ['APAC', 'OCE', 'NA'], audience: 'Hardcore' },
  { name: 'Nordwind Apparel', industry: 'Vêtements', tier: 3, regions: ['EU'], audience: 'Casual' },
  { name: 'STRYDE', industry: 'Vêtements', tier: 4, regions: 'GLOBAL', audience: 'Mainstream' },
  { name: 'Cobalt Pay', industry: 'Services financiers', tier: 4, regions: ['EU', 'NA', 'MENA'], audience: 'Mainstream' },
  { name: 'Ledgerline', industry: 'Services financiers', tier: 2, regions: ['SAM', 'SSA'], audience: 'Casual' },
  { name: 'Corefire GPUs', industry: 'Hardware PC', tier: 5, regions: 'GLOBAL', audience: 'Hardcore' },
  { name: 'Byte Forge PCs', industry: 'Hardware PC', tier: 3, regions: ['NA', 'EU'], audience: 'Hardcore' },
  { name: 'Quanta RAM', industry: 'Hardware PC', tier: 2, regions: ['APAC', 'OCE'], audience: 'Hardcore' },
  { name: 'Skylink Mobile', industry: 'Télécom', tier: 4, regions: ['MENA', 'SSA'], audience: 'Mainstream' },
  { name: 'Fibra Net', industry: 'Télécom', tier: 3, regions: ['SAM'], audience: 'Mainstream' },
  { name: 'Veltro Motors', industry: 'Automobile', tier: 5, regions: ['EU', 'MENA', 'NA'], audience: 'Mainstream' },
  { name: 'Turbo Snack Co', industry: 'Alimentation', tier: 2, regions: 'GLOBAL', audience: 'Casual' },
  { name: 'Crunchwave', industry: 'Alimentation', tier: 3, regions: ['NA', 'OCE'], audience: 'Casual' },
  { name: 'Hexa Headsets', industry: 'Périphériques', tier: 4, regions: 'GLOBAL', audience: 'Hardcore' },
  { name: 'Pixelbank', industry: 'Services financiers', tier: 3, regions: ['APAC'], audience: 'Casual' },
  { name: 'Savanna Bytes', industry: 'Tech', tier: 2, regions: ['SSA'], audience: 'Casual' },
  { name: 'Desert Peak', industry: 'Boisson énergisante', tier: 3, regions: ['MENA'], audience: 'Casual' },
  { name: 'Kanto Gear', industry: 'Périphériques', tier: 2, regions: ['APAC'], audience: 'Hardcore' },
  { name: 'Aussie Grip', industry: 'Vêtements', tier: 1, regions: ['OCE'], audience: 'Casual' },
  { name: 'Rocketeer Cola', industry: 'Alimentation', tier: 4, regions: 'GLOBAL', audience: 'Mainstream' },
  { name: 'Nimbus Cloud', industry: 'Tech', tier: 1, regions: 'GLOBAL', audience: 'Hardcore' },
];

export const DIFFICULTY: Record<Difficulty, { budget: number; sponsor: number; patience: number; label: string; costs: number }> = {
  easy: { budget: 1.8, sponsor: 1.3, patience: 1.6, label: 'Facile', costs: 0.85 },
  normal: { budget: 1, sponsor: 1, patience: 1, label: 'Normal', costs: 1 },
  hard: { budget: 0.7, sponsor: 0.85, patience: 0.75, label: 'Difficile', costs: 1.1 },
  hardcore: { budget: 0.5, sponsor: 0.7, patience: 0.5, label: 'Hardcore', costs: 1.25 },
};
