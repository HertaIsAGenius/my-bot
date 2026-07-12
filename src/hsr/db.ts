import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'data/hsr.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──

function initSchema() {
  db.exec(`
    -- Save slots
    CREATE TABLE IF NOT EXISTS hsr_save_slots (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL CHECK(slot_number BETWEEN 1 AND 5),
      traveler_name TEXT NOT NULL DEFAULT 'Trailblazer',
      express_name TEXT NOT NULL DEFAULT 'Astral Express',
      pronouns TEXT NOT NULL DEFAULT 'they/them',
      starting_path TEXT NOT NULL DEFAULT 'destruction',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_played TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, slot_number)
    );

    -- Core player state per save slot
    CREATE TABLE IF NOT EXISTS hsr_players (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      trailblaze_level INTEGER NOT NULL DEFAULT 1,
      trailblaze_xp INTEGER NOT NULL DEFAULT 0,
      trailblaze_power INTEGER NOT NULL DEFAULT 240,
      trailblaze_power_max INTEGER NOT NULL DEFAULT 240,
      trailblaze_power_last_refill TEXT NOT NULL DEFAULT (datetime('now')),
      credits INTEGER NOT NULL DEFAULT 0,
      stellar_jade INTEGER NOT NULL DEFAULT 0,
      current_world TEXT NOT NULL DEFAULT 'herta_space_station',
      current_location TEXT NOT NULL DEFAULT 'master_control_zone',
      current_quest_id TEXT,
      cold_meter INTEGER NOT NULL DEFAULT 100,
      cold_meter_max INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, slot_number),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_save_slots(user_id, slot_number)
    );

    -- Reference: Paths
    CREATE TABLE IF NOT EXISTS hsr_paths (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      passive_bonus TEXT NOT NULL DEFAULT ''
    );

    -- Reference: Characters
    CREATE TABLE IF NOT EXISTS hsr_characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      element TEXT NOT NULL,
      rarity INTEGER NOT NULL CHECK(rarity IN (4,5)),
      base_hp INTEGER NOT NULL DEFAULT 100,
      base_atk INTEGER NOT NULL DEFAULT 50,
      base_def INTEGER NOT NULL DEFAULT 40,
      base_speed INTEGER NOT NULL DEFAULT 100,
      taunt_value INTEGER NOT NULL DEFAULT 100,
      is_free BOOLEAN NOT NULL DEFAULT 0,
      obtain_source TEXT NOT NULL DEFAULT 'warp',
      ascension_materials TEXT NOT NULL DEFAULT '[]',
      trace_data TEXT NOT NULL DEFAULT '{}',
      skill_description TEXT NOT NULL DEFAULT '',
      ultimate_description TEXT NOT NULL DEFAULT '',
      talent_description TEXT NOT NULL DEFAULT '',
      technique_description TEXT NOT NULL DEFAULT ''
    );

    -- Player-owned characters
    CREATE TABLE IF NOT EXISTS hsr_player_characters (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      character_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      ascension INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0,
      total_xp INTEGER NOT NULL DEFAULT 0,
      equipped INTEGER NOT NULL DEFAULT 0,
      party_slot INTEGER CHECK(party_slot BETWEEN 1 AND 4),
      affinity INTEGER NOT NULL DEFAULT 0,
      skill_levels TEXT NOT NULL DEFAULT '{"basic":1,"skill":1,"ultimate":1,"talent":1,"technique":1}',
      PRIMARY KEY (user_id, slot_number, character_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number),
      FOREIGN KEY (character_id) REFERENCES hsr_characters(id)
    );

    -- Relics
    CREATE TABLE IF NOT EXISTS hsr_relics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      character_id TEXT,
      set_name TEXT NOT NULL,
      piece_type TEXT NOT NULL CHECK(piece_type IN ('head','hands','body','feet','planar_sphere','link_rope')),
      rarity INTEGER NOT NULL CHECK(rarity BETWEEN 3 AND 5),
      level INTEGER NOT NULL DEFAULT 0,
      main_stat TEXT NOT NULL DEFAULT '{}',
      sub_stats TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Light Cones
    CREATE TABLE IF NOT EXISTS hsr_light_cones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      character_id TEXT,
      name TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      ascension INTEGER NOT NULL DEFAULT 0,
      superimpose INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Inventory
    CREATE TABLE IF NOT EXISTS hsr_inventory (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, slot_number, item_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Reference: Materials/Items
    CREATE TABLE IF NOT EXISTS hsr_materials (
      item_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'material',
      rarity INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      world_id TEXT
    );

    -- Reference: Worlds
    CREATE TABLE IF NOT EXISTS hsr_worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      display_order INTEGER NOT NULL DEFAULT 0,
      has_cold_meter INTEGER NOT NULL DEFAULT 0,
      reputation_tiers INTEGER NOT NULL DEFAULT 6
    );

    -- Reference: Locations
    CREATE TABLE IF NOT EXISTS hsr_locations (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location_type TEXT NOT NULL DEFAULT 'zone',
      connected_locations TEXT NOT NULL DEFAULT '[]',
      unlock_condition TEXT,
      has_cold INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (world_id) REFERENCES hsr_worlds(id)
    );

    -- Player exploration
    CREATE TABLE IF NOT EXISTS hsr_discovered_locations (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      location_id TEXT NOT NULL,
      explored INTEGER NOT NULL DEFAULT 0,
      secrets_found INTEGER NOT NULL DEFAULT 0,
      total_secrets INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, slot_number, location_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Reference: Quests
    CREATE TABLE IF NOT EXISTS hsr_quests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      quest_type TEXT NOT NULL DEFAULT 'main',
      world_id TEXT,
      location_id TEXT,
      required_tb_level INTEGER NOT NULL DEFAULT 0,
      prerequisites TEXT NOT NULL DEFAULT '[]',
      objectives TEXT NOT NULL DEFAULT '[]',
      choices TEXT NOT NULL DEFAULT '[]',
      rewards TEXT NOT NULL DEFAULT '{}',
      display_order INTEGER NOT NULL DEFAULT 0
    );

    -- Player quest progress
    CREATE TABLE IF NOT EXISTS hsr_player_quests (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      quest_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','active','completed','failed')),
      objective_progress TEXT NOT NULL DEFAULT '[]',
      choice_history TEXT NOT NULL DEFAULT '[]',
      completed_at TEXT,
      PRIMARY KEY (user_id, slot_number, quest_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Reference: Express rooms
    CREATE TABLE IF NOT EXISTS hsr_express_rooms (
      room_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      unlock_condition TEXT,
      max_level INTEGER NOT NULL DEFAULT 5,
      base_production TEXT NOT NULL DEFAULT '{}',
      upgrade_costs TEXT NOT NULL DEFAULT '[]'
    );

    -- Player express state
    CREATE TABLE IF NOT EXISTS hsr_player_express (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      room_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      last_collected TEXT,
      PRIMARY KEY (user_id, slot_number, room_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Reference: Warp banners
    CREATE TABLE IF NOT EXISTS hsr_warp_banners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      banner_type TEXT NOT NULL DEFAULT 'standard' CHECK(banner_type IN ('standard','limited')),
      is_active INTEGER NOT NULL DEFAULT 0,
      rate_up_5star TEXT NOT NULL DEFAULT '[]',
      rate_up_4star TEXT NOT NULL DEFAULT '[]',
      start_date TEXT,
      end_date TEXT
    );

    -- Warp history
    CREATE TABLE IF NOT EXISTS hsr_warp_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      banner_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      rarity INTEGER NOT NULL CHECK(rarity IN (4,5)),
      pull_number INTEGER NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Pity counters
    CREATE TABLE IF NOT EXISTS hsr_pity (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      banner_id TEXT NOT NULL,
      pity_5 INTEGER NOT NULL DEFAULT 0,
      pity_4 INTEGER NOT NULL DEFAULT 0,
      guaranteed_5 INTEGER NOT NULL DEFAULT 0,
      guaranteed_4 INTEGER NOT NULL DEFAULT 0,
      total_pulls INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, slot_number, banner_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- World reputation
    CREATE TABLE IF NOT EXISTS hsr_reputation (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      world_id TEXT NOT NULL,
      reputation INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, slot_number, world_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Reference: Achievements
    CREATE TABLE IF NOT EXISTS hsr_achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'progression',
      rewards TEXT NOT NULL DEFAULT '{}',
      hidden INTEGER NOT NULL DEFAULT 0
    );

    -- Player achievements
    CREATE TABLE IF NOT EXISTS hsr_player_achievements (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked INTEGER NOT NULL DEFAULT 0,
      unlocked_at TEXT,
      PRIMARY KEY (user_id, slot_number, achievement_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Reference: Daily commissions pool
    CREATE TABLE IF NOT EXISTS hsr_daily_commissions (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      commission_type TEXT NOT NULL CHECK(commission_type IN ('combat','gather','explore','craft','deliver')),
      objectives TEXT NOT NULL DEFAULT '[]',
      rewards TEXT NOT NULL DEFAULT '{}',
      location_id TEXT,
      min_tb_level INTEGER NOT NULL DEFAULT 0
    );

    -- Player daily state
    CREATE TABLE IF NOT EXISTS hsr_player_dailies (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      date TEXT NOT NULL,
      commission_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      progress TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (user_id, slot_number, date, commission_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Reference: Enemies
    CREATE TABLE IF NOT EXISTS hsr_enemies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      element TEXT NOT NULL DEFAULT 'physical',
      weaknesses TEXT NOT NULL DEFAULT '[]',
      resistances TEXT NOT NULL DEFAULT '[]',
      hp INTEGER NOT NULL DEFAULT 100,
      atk INTEGER NOT NULL DEFAULT 20,
      def INTEGER NOT NULL DEFAULT 15,
      speed INTEGER NOT NULL DEFAULT 100,
      toughness INTEGER NOT NULL DEFAULT 60,
      location_id TEXT,
      is_elite INTEGER NOT NULL DEFAULT 0,
      is_boss INTEGER NOT NULL DEFAULT 0,
      loot TEXT NOT NULL DEFAULT '{}',
      skills TEXT NOT NULL DEFAULT '[]'
    );

    -- Discord progression gates
    CREATE TABLE IF NOT EXISTS hsr_progression_gates (
      discord_level INTEGER PRIMARY KEY,
      feature_name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );

    -- Dialogue tree nodes
    CREATE TABLE IF NOT EXISTS hsr_dialogue_nodes (
      node_id TEXT PRIMARY KEY,
      quest_id TEXT NOT NULL,
      npc_name TEXT NOT NULL DEFAULT '',
      dialogue_text TEXT NOT NULL DEFAULT '',
      choices TEXT NOT NULL DEFAULT '[]',
      is_start INTEGER NOT NULL DEFAULT 0
    );

    -- Simulated Universe state
    CREATE TABLE IF NOT EXISTS hsr_simulated_universe (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      week_start TEXT,
      current_floor INTEGER NOT NULL DEFAULT 1,
      blessings TEXT NOT NULL DEFAULT '[]',
      curses TEXT NOT NULL DEFAULT '[]',
      completed_this_week INTEGER NOT NULL DEFAULT 0,
      best_floor INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, slot_number),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );

    -- Resource nodes (harvestable world objects)
    CREATE TABLE IF NOT EXISTS hsr_resource_nodes (
      node_id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      resource_item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      gather_time_seconds INTEGER NOT NULL DEFAULT 30
    );

    -- Daily gathering state
    CREATE TABLE IF NOT EXISTS hsr_gathered_resources (
      user_id TEXT NOT NULL,
      slot_number INTEGER NOT NULL,
      node_id TEXT NOT NULL,
      last_gathered TEXT,
      times_gathered_today INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, slot_number, node_id),
      FOREIGN KEY (user_id, slot_number) REFERENCES hsr_players(user_id, slot_number)
    );
  `);
}

// ── Seed data ──

function seedPaths() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_paths').get() as any;
  if (existing.c > 0) return;

  const insert = db.prepare(`INSERT INTO hsr_paths (id, name, description, passive_bonus) VALUES (?, ?, ?, ?)`);
  db.transaction(() => {
    insert.run('destruction', 'Destruction', 'Balanced damage dealers who excel at both single-target and AoE. Their passive bolsters them in dire situations.', '+10% damage dealt when HP is below 50%');
    insert.run('hunt', 'The Hunt', 'Single-target specialists who eliminate high-value threats first. Their passive gives them blazing speed.', '+15% Speed for the first round of combat');
    insert.run('erudition', 'Erudition', 'Masters of area-of-effect damage who decimate grouped enemies. Their passive fuels their ultimate.', '+3 Energy per enemy defeated with an ability');
    insert.run('harmony', 'Harmony', 'Amplifiers who empower the entire party. Their passive provides a crucial opening advantage.', '+1 Skill Point at the start of each wave');
    insert.run('nihility', 'Nihility', 'Weakeners who debilitate enemies with lingering effects. Their passive extends the pain.', 'Debuffs inflicted on enemies last 1 additional turn');
    insert.run('preservation', 'Preservation', 'Immovable defenders who shield the party from harm. Their passive draws enemy attention.', '+15% DEF. Taking damage has a 25% chance to taunt the attacker for 1 turn');
    insert.run('abundance', 'Abundance', 'Sustains who keep the party alive through any ordeal. Their passive provides steady regeneration.', 'Heal 5% of max HP per character at the start of each turn');
  })();
}

function seedStarterCharacters() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_characters').get() as any;
  if (existing.c > 0) return;

  const insert = db.prepare(`INSERT INTO hsr_characters
    (id, name, path, element, rarity, base_hp, base_atk, base_def, base_speed, taunt_value, is_free, obtain_source, ascension_materials, trace_data, skill_description, ultimate_description, talent_description, technique_description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  db.transaction(() => {
    insert.run('trailblazer_physical', 'Trailblazer', 'destruction', 'physical', 5, 1200, 100, 80, 100, 125, 1, 'story', '[]', '{}',
      'Deals Physical DMG to a single enemy.',
      'Deals massive Physical DMG to a single enemy.',
      'Every hit increases damage dealt on next attack.',
      'Immediately restores HP after entering combat.');

    insert.run('march_7th', 'March 7th', 'preservation', 'ice', 4, 1100, 70, 90, 100, 125, 1, 'story', '[]', '{}',
      'Deals Ice DMG to a single enemy and reduces their ATK.',
      'Deals Ice DMG to all enemies and freezes them.',
      'Shields an ally when they are attacked.',
      'Creates a shield for the entire party at the start of combat.');

    insert.run('dan_heng', 'Dan Heng', 'hunt', 'wind', 4, 950, 95, 70, 110, 100, 1, 'story', '[]', '{}',
      'Deals Wind DMG to a single enemy.',
      'Deals massive Wind DMG to a single enemy with bonus CRIT Rate.',
      'Attacks after an ally targets the same enemy.',
      'Increases SPD for the first turn.');

    insert.run('asta', 'Asta', 'harmony', 'fire', 4, 1000, 75, 70, 105, 100, 1, 'story', '[]', '{}',
      'Deals Fire DMG to a single enemy.',
      'Deals Fire DMG to all enemies and charges the party ATK.',
      'Gains a stack of ATK buff each time she attacks a different enemy.',
      'Immediately attacks all enemies at the start of combat.');

    insert.run('herta', 'Herta', 'erudition', 'ice', 4, 950, 80, 65, 100, 100, 0, 'warp', '[]', '{}',
      'Deals Ice DMG to all enemies.',
      'Deals massive Ice DMG to all enemies.',
      'Triggers follow-up attack when an ally reduces an enemy below 50% HP.',
      'Attacks all enemies at the start of combat.');

    insert.run('natasha', 'Natasha', 'abundance', 'physical', 4, 1050, 65, 75, 98, 100, 0, 'warp', '[]', '{}',
      'Deals Physical DMG and heals the ally with the lowest HP.',
      'Heals the entire party.',
      'Heals an ally when they fall below 30% HP.',
      'Heals the party at the start of combat.');

    insert.run('sampo', 'Sampo', 'nihility', 'wind', 4, 900, 85, 65, 105, 100, 0, 'warp', '[]', '{}',
      'Deals Wind DMG and has a chance to Wind Shear.',
      'Deals Wind DMG to all enemies and increases Wind Shear damage taken.',
      'Wind Shear deals additional DMG each turn.',
      'Inflicts Wind Shear on all enemies.');

    insert.run('serval', 'Serval', 'erudition', 'lightning', 4, 950, 85, 65, 100, 100, 0, 'warp', '[]', '{}',
      'Deals Lightning DMG to a single enemy.',
      'Deals Lightning DMG to all enemies and extends Shock duration.',
      'Shocks enemies after using Skill.',
      'Attacks all enemies with a chance to Shock them.');

    insert.run('sushang', 'Sushang', 'hunt', 'physical', 4, 950, 90, 65, 107, 100, 0, 'warp', '[]', '{}',
      'Deals Physical DMG to a single enemy. Last hit has increased DMG.',
      'Deals massive Physical DMG to a single enemy and advances her next action.',
      'Gains ATK up after breaking Weakness.',
      'Attacks an enemy and reduces their DEF.');

    insert.run('hook', 'Hook', 'destruction', 'fire', 4, 1050, 85, 70, 97, 125, 0, 'warp', '[]', '{}',
      'Deals Fire DMG to a single enemy and has a chance to Burn.',
      'Deals Fire DMG to all enemies and detonates all Burns.',
      'Enhanced attacks against Burning enemies.',
      'Attacks all enemies with Fire DMG.');

    insert.run('yukong', 'Yukong', 'harmony', 'imaginary', 4, 950, 80, 65, 105, 100, 0, 'warp', '[]', '{}',
      'Deals Imaginary DMG to a single enemy.',
      'Deals Imaginary DMG to all enemies and increases party CRIT Rate.',
      'Gains a stack of ATK buff when using Skill.',
      'Increases party ATK for the first 2 turns.');
  })();
}

function seedWorlds() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_worlds').get() as any;
  if (existing.c > 0) return;

  const insert = db.prepare(`INSERT INTO hsr_worlds (id, name, description, display_order, has_cold_meter, reputation_tiers) VALUES (?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    insert.run('herta_space_station', 'Herta Space Station', 'A sprawling research station orbiting a barren world. Home to Genius Society researchers.', 0, 0, 3);
    insert.run('belobog', 'Belobog', 'The last city beneath a eternal freeze. The underground and overworld struggle to survive.', 1, 1, 6);
    insert.run('xianzhou_luofu', 'The Xianzhou Luofu', 'A colossal flagship of the Xianzhou Alliance. (Coming soon)', 2, 0, 0);
  })();
}

function seedLocations() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_locations').get() as any;
  if (existing.c > 0) return;

  const insert = db.prepare(`INSERT INTO hsr_locations (id, world_id, name, description, location_type, connected_locations, unlock_condition, has_cold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    // Herta Space Station
    insert.run('master_control_zone', 'herta_space_station', 'Master Control Zone', 'The heart of the space station, where researchers coordinate experiments and study Stellaron activity.', 'zone', '["base_zone","storage_zone"]', null, 0);
    insert.run('base_zone', 'herta_space_station', 'Base Zone', 'The main residential and administrative area of the space station.', 'zone', '["master_control_zone","storage_zone"]', null, 0);
    insert.run('storage_zone', 'herta_space_station', 'Storage Zone', 'A vast warehouse area filled with artifacts, research samples, and forgotten experiments.', 'zone', '["master_control_zone","base_zone"]', null, 0);

    // Belobok
    insert.run('administrative_district', 'belobog', 'Administrative District', 'The frozen heart of Belobog\'s overworld, where the Architects maintain order and the Supreme Guardian rules.', 'zone', '["great_mine","rivet_town","outlying_snow_plains"]', 'quest_herta_complete', 1);
    insert.run('great_mine', 'belobog', 'Great Mine', 'A massive excavation site on the surface, yielding precious ores and geothermal energy for the city.', 'zone', '["administrative_district","rivet_town"]', 'quest_herta_complete', 1);
    insert.run('rivet_town', 'belobog', 'Rivet Town', 'An abandoned mining town swallowed by the surface cold. Now home to outlaws and relic hunters.', 'zone', '["administrative_district","great_mine","robot_settlement"]', 'quest_herta_complete', 1);
    insert.run('robot_settlement', 'belobog', 'Robot Settlement', 'A hidden community of intelligent machines who fled the wars of the past.', 'zone', '["rivet_town","backwater_pass"]', 'quest_belobog_arrival', 1);
    insert.run('backwater_pass', 'belobog', 'Backwater Pass', 'A treacherous mountain passage connecting the surface to the underworld.', 'zone', '["robot_settlement","administrative_district"]', 'quest_belobog_arrival', 1);
    insert.run('outlying_snow_plains', 'belobog', 'Outlying Snow Plains', 'The frozen wasteland beyond Belobog\'s walls. Only the desperate or foolish venture here.', 'zone', '["administrative_district","qlipoth_fort"]', 'quest_belobog_arrival', 1);
    insert.run('qlipoth_fort', 'belobog', 'Qlipoth Fort', 'An ancient fortress built to honor the Aeon of Preservation. The Fragmentum monster stirs beneath it.', 'zone', '["outlying_snow_plains"]', 'quest_belobog_advanced', 1);
  })();
}

function generateUpgradeCosts(roomId: string, maxLevel: number): any[] {
  const costs: any[] = [];
  const matSets: Record<string, { mat: string; interval: number; baseQty: number }[]> = {
    workshop: [
      { mat: 'thief_bell', interval: 5, baseQty: 3 },
      { mat: 'inferno_core', interval: 10, baseQty: 2 },
      { mat: 'ancient_part', interval: 20, baseQty: 1 },
    ],
    forge: [
      { mat: 'thief_bell', interval: 5, baseQty: 5 },
      { mat: 'inferno_core', interval: 10, baseQty: 3 },
      { mat: 'ancient_part', interval: 15, baseQty: 1 },
    ],
    storage_room: [
      { mat: 'thief_bell', interval: 5, baseQty: 2 },
    ],
    relic_vault: [
      { mat: 'thief_bell', interval: 5, baseQty: 3 },
      { mat: 'inferno_core', interval: 15, baseQty: 2 },
    ],
  };
  const mats = matSets[roomId] || [];
  for (let lv = 2; lv <= maxLevel; lv++) {
    const credits = Math.round(250 * Math.pow(lv, 1.25));
    const materials: Record<string, number> = {};
    for (const m of mats) {
      if (lv % m.interval === 0) {
        const qty = Math.max(1, Math.floor(m.baseQty * Math.pow(lv / m.interval, 0.8)));
        materials[m.mat] = qty;
      }
    }
    costs.push({ level: lv, credits, materials: Object.keys(materials).length > 0 ? materials : undefined });
  }
  return costs;
}

function seedExpressRooms() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_express_rooms').get() as any;

  if (existing.c === 0) {
    const insert = db.prepare(`INSERT INTO hsr_express_rooms (room_id, name, description, unlock_condition, max_level, base_production, upgrade_costs) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    db.transaction(() => {
      const maxLv = 100;
      insert.run('workshop', 'Workshop', 'Craft upgrade materials and create equipment from gathered resources.', null, maxLv, '{"crafting_slots":1,"craft_speed_bonus":0}', JSON.stringify(generateUpgradeCosts('workshop', maxLv)));
      insert.run('storage_room', "Herta's Coupons", 'Exchange Herta Bonds for limited rewards, including Light Cones and upgrade materials.', null, maxLv, '{"bonus_inventory_slots":10}', JSON.stringify(generateUpgradeCosts('storage_room', maxLv)));
      insert.run('forge', 'Forge', 'Improve gear, upgrade relic enhancement, and refine materials.', null, maxLv, '{"relic_xp_bonus":0,"enhance_cost_reduction":0}', JSON.stringify(generateUpgradeCosts('forge', maxLv)));
      insert.run('relic_vault', 'Relic Vault', 'Display and manage collected relic sets with a visual showcase.', null, maxLv, '{"display_slots":5,"set_bonus_preview":0}', JSON.stringify(generateUpgradeCosts('relic_vault', maxLv)));
    })();
    return;
  }

  // Migration: update existing rows
  db.transaction(() => {
    db.prepare("UPDATE hsr_express_rooms SET name = 'Herta''s Coupons' WHERE room_id = 'storage_room'").run();
    const maxLv = 100;
    db.prepare('UPDATE hsr_express_rooms SET max_level = ? WHERE max_level < ?').run(maxLv, maxLv);
    for (const roomId of ['workshop', 'storage_room', 'forge', 'relic_vault']) {
      const costs = JSON.stringify(generateUpgradeCosts(roomId, maxLv));
      db.prepare('UPDATE hsr_express_rooms SET upgrade_costs = ? WHERE room_id = ?').run(costs, roomId);
    }
  })();
}

function seedMaterials() {
  const existingRows = db.prepare('SELECT item_id FROM hsr_materials').all() as any[];
  const existingIds = new Set(existingRows.map((row: any) => row.item_id));

  const insert = db.prepare(`INSERT INTO hsr_materials (item_id, name, type, rarity, description, source, world_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    const rows = [
      ['thief_bell', 'Thief\'s Bell', 'ascension_material', 2, 'A bell stolen by a mischievous spirit. Common ascension material.', 'Enemy drops: Herta Space Station', 'herta_space_station'],
      ['inferno_core', 'Inferno Core', 'trace_material', 3, 'The smoldering heart of a defeated flame. Used for trace upgrades.', 'Enemy drops: Belobog', 'belobog'],
      ['ancient_part', 'Ancient Part', 'ascension_material', 3, 'A fragment of ancient machinery found in Belobog\'s ruins.', 'Enemy drops: Belobog', 'belobog'],
      ['credit', 'Credit', 'currency', 1, 'The universal currency used across the cosmos.', 'Various sources', null],
      ['stellar_jade', 'Stellar Jade', 'currency', 5, 'A precious gem formed from crystallized Stellaron energy. Used for Warps.', 'Various sources', null],
      ['travel_guide', 'Travel\'s Guide', 'char_exp', 3, 'A collection of survival tips from across the galaxy. Grants 6000 character XP.', 'Calyx: Bud of Memories', null],
      ['adventure_log', 'Adventure Log', 'char_exp', 2, 'Records of a Trailblazer\'s journey. Grants 3000 character XP.', 'Calyx: Bud of Memories', null],
      ['relic_fragment', 'Relic Fragment', 'relic_exp', 2, 'A broken piece of an old relic. Salvaged for enhancement material.', 'Relic Caverns, Salvage', null],
      ['usurper_scheme', 'Usurper\'s Scheme', 'ascension_material', 3, 'A cunning plan devised by a renegade. Uncommon Antimatter Legion drop.', 'Enemy drops', 'herta_space_station'],
      ['conqueror_will', 'Conqueror\'s Will', 'ascension_material', 4, 'The indomitable will of a vanquished conqueror. Rare Antimatter Legion drop.', 'Enemy drops', 'herta_space_station'],
      ['legion_insignia', 'Legion Commander\'s Insignia', 'ascension_material', 5, 'A badge of supreme authority within the Antimatter Legion. Legendary drop.', 'Enemy drops', 'herta_space_station'],
      ['glimmering_core', 'Glimmering Core', 'trace_material', 3, 'A core that still pulses with faint Fragmentum energy. Uncommon drop.', 'Enemy drops', 'belobog'],
      ['squirming_core', 'Squirming Core', 'trace_material', 4, 'A core that writhes with corrupted life. Rare Fragmentum drop.', 'Enemy drops', 'belobog'],
      ['fragmentum_heart', 'Fragmentum Heart', 'trace_material', 5, 'The crystallized heart of a Fragmentum monster. Legendary drop.', 'Enemy drops', 'belobog'],
      ['ancient_spindle', 'Ancient Spindle', 'ascension_material', 3, 'A perfectly preserved spindle from ancient machinery. Uncommon Mechanical drop.', 'Enemy drops', 'belobog'],
      ['ancient_engine', 'Ancient Engine', 'ascension_material', 4, 'A rusted but still humming engine core. Rare Mechanical drop.', 'Enemy drops', 'belobog'],
      ['ancient_quantum_core', 'Ancient Quantum Core', 'ascension_material', 5, 'A quantum-entangled core from a bygone era. Legendary Mechanical drop.', 'Enemy drops', 'belobog'],
      ['limited_wish', 'Limited Wish', 'currency', 4, 'A special wish ticket used to attempt a limited banner pull.', 'Warp shop', null],
      ['standard_wish', 'Standard Wish', 'currency', 4, 'A standard wish ticket used to attempt a standard banner pull.', 'Warp shop', null],
    ] as Array<[string, string, string, number, string, string | null, string | null]>;

    for (const row of rows) {
      if (existingIds.has(row[0])) continue;
      insert.run(...row);
    }
  })();
}

function seedBanners() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_warp_banners').get() as any;
  if (existing.c > 0) return;

  const insert = db.prepare(`INSERT INTO hsr_warp_banners (id, name, banner_type, is_active, rate_up_5star, rate_up_4star, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  insert.run('stellar_warp', 'Stellar Warp', 'standard', 1, '[]', '["herta","natasha","sampo","serval","sushang","hook","yukong"]', null, null);
}

function seedCommissions() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_daily_commissions').get() as any;
  if (existing.c > 0) return;

  const insert = db.prepare(`INSERT INTO hsr_daily_commissions (id, description, commission_type, objectives, rewards, location_id, min_tb_level) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    insert.run('daily_combat_1', 'Defeat 5 enemies in combat.', 'combat', '[{"type":"defeat_enemies","target":5}]', '{"credits":500,"stellar_jade":10,"trailblaze_xp":100}', null, 1);
    insert.run('daily_combat_2', 'Defeat an elite enemy.', 'combat', '[{"type":"defeat_elite","target":1}]', '{"credits":800,"stellar_jade":15,"trailblaze_xp":150,"relic_fragment":3}', null, 3);
    insert.run('daily_gather_1', 'Gather 10 resources from the current world.', 'gather', '[{"type":"gather_resources","target":10}]', '{"credits":300,"stellar_jade":5,"trailblaze_xp":75}', null, 1);
    insert.run('daily_explore_1', 'Visit 3 different locations.', 'explore', '[{"type":"explore_locations","target":3}]', '{"credits":400,"stellar_jade":10,"trailblaze_xp":100}', null, 1);
    insert.run('daily_craft_1', 'Craft 2 items at the Workshop.', 'craft', '[{"type":"craft_items","target":2}]', '{"credits":500,"stellar_jade":10,"trailblaze_xp":100}', null, 2);
    insert.run('daily_deliver_1', 'Complete a delivery to a specific location.', 'deliver', '[{"type":"deliver_to","target":1}]', '{"credits":600,"stellar_jade":15,"trailblaze_xp":125}', null, 2);
  })();
}

// ── Enemies seed data ──

const ENEMIES = [
  // ── Master Control Zone ──
  { id: 'voidranger_reaver', name: 'Voidranger Reaver', element: 'physical', weaknesses: JSON.stringify(['fire', 'wind']), resistances: JSON.stringify(['physical']), hp: 120, atk: 15, def: 10, speed: 95, toughness: 30, location_id: 'master_control_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Strike', multiplier: 1.0 }]) },
  { id: 'voidranger_distorter', name: 'Voidranger Distorter', element: 'imaginary', weaknesses: JSON.stringify(['physical', 'lightning']), resistances: JSON.stringify(['imaginary']), hp: 110, atk: 17, def: 12, speed: 100, toughness: 28, location_id: 'master_control_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Warp', multiplier: 1.1 }]) },
  { id: 'voidranger_eliminator', name: 'Voidranger Eliminator', element: 'fire', weaknesses: JSON.stringify(['ice', 'imaginary']), resistances: JSON.stringify(['fire']), hp: 100, atk: 18, def: 8, speed: 105, toughness: 25, location_id: 'master_control_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Blast', multiplier: 1.2 }]) },
  { id: 'voidranger_trampler', name: 'Voidranger Trampler', element: 'physical', weaknesses: JSON.stringify(['wind', 'imaginary']), resistances: JSON.stringify(['physical']), hp: 140, atk: 14, def: 14, speed: 90, toughness: 32, location_id: 'master_control_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Trample', multiplier: 1.0 }]) },
  { id: 'space_hound', name: 'Space Hound', element: 'physical', weaknesses: JSON.stringify(['fire', 'lightning']), resistances: JSON.stringify(['physical']), hp: 90, atk: 12, def: 8, speed: 110, toughness: 20, location_id: 'master_control_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Bite', multiplier: 1.0 }]) },
  { id: 'voidranger_ranger', name: 'Voidranger Ranger', element: 'wind', weaknesses: JSON.stringify(['ice', 'lightning']), resistances: JSON.stringify(['wind']), hp: 105, atk: 16, def: 10, speed: 102, toughness: 26, location_id: 'master_control_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Arrow', multiplier: 1.1 }]) },
  // ── Base Zone ──
  { id: 'antibaryon', name: 'Antibaryon', element: 'imaginary', weaknesses: JSON.stringify(['physical', 'wind']), resistances: JSON.stringify(['imaginary']), hp: 95, atk: 14, def: 10, speed: 98, toughness: 24, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Pulse', multiplier: 1.0 }]) },
  { id: 'baryon', name: 'Baryon', element: 'imaginary', weaknesses: JSON.stringify(['fire', 'ice']), resistances: JSON.stringify(['imaginary']), hp: 100, atk: 15, def: 11, speed: 96, toughness: 25, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Discharge', multiplier: 1.0 }]) },
  { id: 'flame_spawn', name: 'Flame Spawn', element: 'fire', weaknesses: JSON.stringify(['ice', 'wind']), resistances: JSON.stringify(['fire']), hp: 80, atk: 20, def: 6, speed: 108, toughness: 18, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Ignite', multiplier: 1.2 }]) },
  { id: 'frost_spawn', name: 'Frost Spawn', element: 'ice', weaknesses: JSON.stringify(['fire', 'physical']), resistances: JSON.stringify(['ice']), hp: 85, atk: 19, def: 8, speed: 105, toughness: 20, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Freeze', multiplier: 1.1 }]) },
  { id: 'blaze_out_of_space', name: 'Blaze Out of Space', element: 'fire', weaknesses: JSON.stringify(['ice', 'lightning']), resistances: JSON.stringify(['fire']), hp: 130, atk: 22, def: 10, speed: 100, toughness: 30, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Inferno', multiplier: 1.3 }]) },
  { id: 'ice_out_of_space', name: 'Ice Out of Space', element: 'ice', weaknesses: JSON.stringify(['fire', 'wind']), resistances: JSON.stringify(['ice']), hp: 135, atk: 20, def: 12, speed: 98, toughness: 32, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Blizzard', multiplier: 1.2 }]) },
  { id: 'voidranger_suppressor', name: 'Voidranger Suppressor', element: 'quantum', weaknesses: JSON.stringify(['physical', 'fire']), resistances: JSON.stringify(['quantum']), hp: 115, atk: 16, def: 13, speed: 97, toughness: 27, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Suppress', multiplier: 1.1 }]) },
  { id: 'imaginary_weaver', name: 'Imaginary Weaver', element: 'imaginary', weaknesses: JSON.stringify(['wind', 'lightning']), resistances: JSON.stringify(['imaginary']), hp: 120, atk: 18, def: 10, speed: 100, toughness: 28, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Weave', multiplier: 1.1 }]) },
  { id: 'incineration_shadewalker', name: 'Incineration Shadewalker', element: 'fire', weaknesses: JSON.stringify(['ice', 'physical']), resistances: JSON.stringify(['fire']), hp: 150, atk: 24, def: 14, speed: 95, toughness: 35, location_id: 'base_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Shadowflame', multiplier: 1.4 }]) },
  // ── Storage Zone ──
  { id: 'lightning_spawn', name: 'Lightning Spawn', element: 'lightning', weaknesses: JSON.stringify(['wind', 'imaginary']), resistances: JSON.stringify(['lightning']), hp: 85, atk: 21, def: 6, speed: 110, toughness: 19, location_id: 'storage_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Shock', multiplier: 1.2 }]) },
  { id: 'wind_spawn', name: 'Wind Spawn', element: 'wind', weaknesses: JSON.stringify(['fire', 'ice']), resistances: JSON.stringify(['wind']), hp: 80, atk: 20, def: 7, speed: 112, toughness: 18, location_id: 'storage_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Gust', multiplier: 1.1 }]) },
  { id: 'frigid_prowler', name: 'Frigid Prowler', element: 'ice', weaknesses: JSON.stringify(['fire', 'imaginary']), resistances: JSON.stringify(['ice']), hp: 140, atk: 22, def: 12, speed: 97, toughness: 33, location_id: 'storage_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Prowl', multiplier: 1.3 }]) },
  { id: 'automaton_beetle', name: 'Automaton Beetle', element: 'physical', weaknesses: JSON.stringify(['lightning', 'fire']), resistances: JSON.stringify(['physical']), hp: 130, atk: 17, def: 16, speed: 88, toughness: 30, location_id: 'storage_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'mechanical' }), skills: JSON.stringify([{ name: 'Crush', multiplier: 1.1 }]) },
  { id: 'imaginary_warp_trotter', name: 'Imaginary Warp Trotter', element: 'imaginary', weaknesses: JSON.stringify(['physical', 'fire', 'ice']), resistances: JSON.stringify(['imaginary']), hp: 60, atk: 10, def: 5, speed: 120, toughness: 15, location_id: 'storage_zone', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'antimatter_legion' }), skills: JSON.stringify([{ name: 'Flee', multiplier: 0.5 }]) },
  // ── Belobog — Administrative District ──
  { id: 'silvermane_cannonner', name: 'Silvermane Cannonner', element: 'fire', weaknesses: JSON.stringify(['physical', 'lightning']), resistances: JSON.stringify([]), hp: 150, atk: 20, def: 12, speed: 90, toughness: 35, location_id: 'administrative_district', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Cannon Blast', multiplier: 1.3 }]) },
  { id: 'silvermane_soldier', name: 'Silvermane Soldier', element: 'physical', weaknesses: JSON.stringify(['lightning', 'wind']), resistances: JSON.stringify([]), hp: 130, atk: 16, def: 15, speed: 100, toughness: 28, location_id: 'administrative_district', is_elite: 0, is_boss: 0, loot: JSON.stringify({ family: 'fragmentum' }), skills: JSON.stringify([{ name: 'Slash', multiplier: 1.0 }]) },
];

function seedEnemies() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_enemies').get() as any;
  if (existing.c > 0) return;

  const insert = db.prepare(`INSERT OR IGNORE INTO hsr_enemies (id, name, element, weaknesses, resistances, hp, atk, def, speed, toughness, location_id, is_elite, is_boss, loot, skills) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    for (const e of ENEMIES) {
      insert.run(e.id, e.name, e.element, e.weaknesses, e.resistances, e.hp, e.atk, e.def, e.speed, e.toughness, e.location_id, e.is_elite, e.is_boss, e.loot, e.skills);
    }
  })();
}

// ── Herta Station dynamic item pools ──

const HERTA_STATION_ITEMS: Record<string, Array<{ name: string; tag: string }>> = {
  master_control_zone: [
    { name: 'Tool Box', tag: 'Tool Supplies' },
    { name: 'Supply Bin', tag: 'Supply Items' },
    { name: 'Data Chip', tag: 'Digital Data' },
    { name: 'Utility Case', tag: 'Utility Supplies' },
    { name: 'Portable Scanner', tag: 'Scanning Equipment' },
    { name: 'Battery Pack', tag: 'Energy Components' },
    { name: 'Parts Crate', tag: 'Mechanical Parts' },
    { name: 'Medical Supply Box', tag: 'Medical Supplies' },
    { name: 'Engineer\'s Kit', tag: 'Engineering Supplies' },
    { name: 'Research Cache', tag: 'Research Materials' },
  ],
  base_zone: [
    { name: 'Experiment Console', tag: 'Research Data' },
    { name: 'Analysis Terminal', tag: 'Research Data' },
    { name: 'Data Archive', tag: 'Archive Data' },
    { name: 'Research Notes', tag: 'Research Documents' },
    { name: 'Specimen Pod', tag: 'Specimen Items' },
    { name: 'Chemical Cabinet', tag: 'Chemical Supplies' },
    { name: 'Sample Tray', tag: 'Sample Items' },
    { name: 'Curio Display', tag: 'Curio Items' },
    { name: 'Diagnostic Station', tag: 'Diagnostic Data' },
    { name: 'Equipment Bench', tag: 'Equipment Parts' },
    { name: 'Calibration Module', tag: 'Calibration Parts' },
    { name: 'Storage Cylinder', tag: 'Stored Materials' },
    { name: 'Test Chamber', tag: 'Experimental Items' },
    { name: 'Observation Capsule', tag: 'Observation Data' },
    { name: 'Energy Cell Rack', tag: 'Energy Components' },
    { name: 'Damaged Terminal', tag: 'Damaged Data' },
    { name: 'Broken Drone', tag: 'Mechanical Parts' },
    { name: 'Discarded Toolkit', tag: 'Tool Parts' },
    { name: 'Loose Components', tag: 'Mechanical Parts' },
    { name: 'Scrap Heap', tag: 'Scrap Materials' },
    { name: 'Ruined Machinery', tag: 'Machine Parts' },
    { name: 'Broken Monitor', tag: 'Electronic Parts' },
    { name: 'Power Junction', tag: 'Energy Components' },
    { name: 'Damaged Container', tag: 'Damaged Storage' },
    { name: 'Scattered Documents', tag: 'Lost Documents' },
    { name: 'Supply Cart', tag: 'Supply Items' },
    { name: 'Maintenance Trolley', tag: 'Maintenance Supplies' },
    { name: 'Abandoned Workstation', tag: 'Workstation Data' },
  ],
  storage_zone: [
    { name: 'Artifact Shelf', tag: 'Storage Items' },
    { name: 'Research Crate', tag: 'Research Materials' },
    { name: 'Forgotten Chest', tag: 'Chest Items' },
    { name: 'Archived Records', tag: 'Archive Items' },
    { name: 'Equipment Rack', tag: 'Equipment Items' },
    { name: 'Sealed Container', tag: 'Container Items' },
    { name: 'Loose Debris', tag: 'Scavenged Items' },
    { name: 'Supply Crate', tag: 'Supply Items' },
    { name: 'Specimen Locker', tag: 'Specimen Items' },
    { name: 'Storage Cabinet', tag: 'Storage Items' },
    { name: 'Utility Cabinet', tag: 'Utility Items' },
    { name: 'Cargo Box', tag: 'Cargo Items' },
    { name: 'IPC Supply Case', tag: 'IPC Supplies' },
    { name: 'Research Locker', tag: 'Research Materials' },
    { name: 'Cryo Container', tag: 'Cryogenic Items' },
    { name: 'Sample Case', tag: 'Sample Items' },
    { name: 'Observation Box', tag: 'Observation Items' },
    { name: 'Maintenance Crate', tag: 'Maintenance Items' },
    { name: 'Security Locker', tag: 'Security Items' },
    { name: 'Emergency Cache', tag: 'Emergency Supplies' },
  ],
};

// ── Tag type → reward mapping ──

interface TagRewardEntry {
  item_id: string;
  minQty: number;
  maxQty: number;
  weight: number;
}

const ITEM_TAG_REWARDS: Record<string, TagRewardEntry[]> = {
  'Chest Items': [
    { item_id: 'credit', minQty: 800, maxQty: 1200, weight: 100 },
    { item_id: 'stellar_jade', minQty: 15, maxQty: 25, weight: 100 },
    { item_id: 'relic_fragment', minQty: 1, maxQty: 2, weight: 100 },
  ],
  'Storage Items': [
    { item_id: 'credit', minQty: 50, maxQty: 150, weight: 60 },
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 40 },
  ],
  'Research Materials': [
    { item_id: 'thief_bell', minQty: 1, maxQty: 3, weight: 40 },
    { item_id: 'inferno_core', minQty: 1, maxQty: 2, weight: 30 },
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 30 },
  ],
  'Archive Items': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 2, weight: 60 },
    { item_id: 'travel_guide', minQty: 1, maxQty: 1, weight: 40 },
  ],
  'Equipment Items': [
    { item_id: 'relic_fragment', minQty: 1, maxQty: 3, weight: 50 },
    { item_id: 'credit', minQty: 100, maxQty: 300, weight: 50 },
  ],
  'Container Items': [
    { item_id: 'credit', minQty: 100, maxQty: 500, weight: 50 },
    { item_id: 'thief_bell', minQty: 1, maxQty: 3, weight: 30 },
    { item_id: 'inferno_core', minQty: 1, maxQty: 2, weight: 20 },
  ],
  'Scavenged Items': [
    { item_id: 'credit', minQty: 20, maxQty: 80, weight: 50 },
    { item_id: 'thief_bell', minQty: 1, maxQty: 1, weight: 50 },
  ],
  'Supply Items': [
    { item_id: 'credit', minQty: 50, maxQty: 200, weight: 50 },
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 50 },
  ],
  'Specimen Items': [
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 40 },
    { item_id: 'ancient_part', minQty: 1, maxQty: 1, weight: 30 },
    { item_id: 'credit', minQty: 50, maxQty: 150, weight: 30 },
  ],
  'Utility Items': [
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 60 },
    { item_id: 'credit', minQty: 30, maxQty: 100, weight: 40 },
  ],
  'Cargo Items': [
    { item_id: 'credit', minQty: 100, maxQty: 400, weight: 50 },
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 30 },
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 20 },
  ],
  'IPC Supplies': [
    { item_id: 'credit', minQty: 200, maxQty: 600, weight: 50 },
    { item_id: 'ancient_part', minQty: 1, maxQty: 3, weight: 50 },
  ],
  'Cryogenic Items': [
    { item_id: 'inferno_core', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'relic_fragment', minQty: 1, maxQty: 1, weight: 50 },
  ],
  'Sample Items': [
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'credit', minQty: 30, maxQty: 100, weight: 50 },
  ],
  'Observation Items': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 60 },
    { item_id: 'credit', minQty: 50, maxQty: 100, weight: 40 },
  ],
  'Maintenance Items': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'credit', minQty: 50, maxQty: 150, weight: 50 },
  ],
  'Security Items': [
    { item_id: 'credit', minQty: 200, maxQty: 500, weight: 50 },
    { item_id: 'relic_fragment', minQty: 1, maxQty: 2, weight: 50 },
  ],
  'Emergency Supplies': [
    { item_id: 'credit', minQty: 100, maxQty: 300, weight: 40 },
    { item_id: 'adventure_log', minQty: 1, maxQty: 2, weight: 30 },
    { item_id: 'relic_fragment', minQty: 1, maxQty: 1, weight: 30 },
  ],
  'Research Data': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 60 },
    { item_id: 'travel_guide', minQty: 1, maxQty: 1, weight: 40 },
  ],
  'Archive Data': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 2, weight: 60 },
    { item_id: 'credit', minQty: 50, maxQty: 150, weight: 40 },
  ],
  'Research Documents': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 2, weight: 100 },
  ],
  'Chemical Supplies': [
    { item_id: 'thief_bell', minQty: 1, maxQty: 3, weight: 50 },
    { item_id: 'inferno_core', minQty: 1, maxQty: 2, weight: 50 },
  ],
  'Curio Items': [
    { item_id: 'relic_fragment', minQty: 1, maxQty: 3, weight: 50 },
    { item_id: 'credit', minQty: 100, maxQty: 500, weight: 30 },
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 20 },
  ],
  'Diagnostic Data': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 60 },
    { item_id: 'credit', minQty: 50, maxQty: 200, weight: 40 },
  ],
  'Equipment Parts': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'credit', minQty: 50, maxQty: 200, weight: 50 },
  ],
  'Calibration Parts': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 1, weight: 50 },
    { item_id: 'credit', minQty: 100, maxQty: 300, weight: 50 },
  ],
  'Stored Materials': [
    { item_id: 'thief_bell', minQty: 1, maxQty: 3, weight: 40 },
    { item_id: 'inferno_core', minQty: 1, maxQty: 2, weight: 30 },
    { item_id: 'credit', minQty: 50, maxQty: 200, weight: 30 },
  ],
  'Experimental Items': [
    { item_id: 'relic_fragment', minQty: 1, maxQty: 2, weight: 40 },
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 30 },
    { item_id: 'credit', minQty: 100, maxQty: 400, weight: 30 },
  ],
  'Observation Data': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 60 },
    { item_id: 'credit', minQty: 50, maxQty: 150, weight: 40 },
  ],
  'Energy Components': [
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 40 },
    { item_id: 'inferno_core', minQty: 1, maxQty: 1, weight: 30 },
    { item_id: 'credit', minQty: 50, maxQty: 200, weight: 30 },
  ],
  'Damaged Data': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 50 },
    { item_id: 'credit', minQty: 20, maxQty: 80, weight: 50 },
  ],
  'Mechanical Parts': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'credit', minQty: 50, maxQty: 150, weight: 50 },
  ],
  'Scrap Materials': [
    { item_id: 'credit', minQty: 10, maxQty: 50, weight: 60 },
    { item_id: 'thief_bell', minQty: 1, maxQty: 1, weight: 40 },
  ],
  'Electronic Parts': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'credit', minQty: 100, maxQty: 300, weight: 50 },
  ],
  'Damaged Storage': [
    { item_id: 'credit', minQty: 20, maxQty: 100, weight: 50 },
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 30 },
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 20 },
  ],
  'Lost Documents': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 60 },
    { item_id: 'credit', minQty: 30, maxQty: 100, weight: 40 },
  ],
  'Maintenance Supplies': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'credit', minQty: 50, maxQty: 150, weight: 50 },
  ],
  'Workstation Data': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 50 },
    { item_id: 'credit', minQty: 50, maxQty: 200, weight: 50 },
  ],
  'Digital Data': [
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 60 },
    { item_id: 'credit', minQty: 50, maxQty: 150, weight: 40 },
  ],
  'Tool Supplies': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 1, weight: 40 },
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 30 },
    { item_id: 'credit', minQty: 30, maxQty: 100, weight: 30 },
  ],
  'Scanning Equipment': [
    { item_id: 'credit', minQty: 100, maxQty: 300, weight: 50 },
    { item_id: 'relic_fragment', minQty: 1, maxQty: 1, weight: 50 },
  ],
  'Medical Supplies': [
    { item_id: 'credit', minQty: 100, maxQty: 300, weight: 50 },
    { item_id: 'adventure_log', minQty: 1, maxQty: 1, weight: 50 },
  ],
  'Engineering Supplies': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 3, weight: 50 },
    { item_id: 'credit', minQty: 100, maxQty: 400, weight: 50 },
  ],
  'Utility Supplies': [
    { item_id: 'thief_bell', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'credit', minQty: 30, maxQty: 100, weight: 50 },
  ],
  'Tool Parts': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 1, weight: 50 },
    { item_id: 'credit', minQty: 30, maxQty: 100, weight: 50 },
  ],
  'Machine Parts': [
    { item_id: 'ancient_part', minQty: 1, maxQty: 2, weight: 50 },
    { item_id: 'credit', minQty: 50, maxQty: 200, weight: 50 },
  ],
};

// ── Material drop family tables (from Enemies Found in Areas.txt) ──

const MATERIAL_DROP_FAMILIES: Record<string, Array<{ item_id: string; weight: number; qty: [number, number] }>> = {
  antimatter_legion: [
    { item_id: 'thief_bell', weight: 66, qty: [1, 2] },
    { item_id: 'usurper_scheme', weight: 25, qty: [1, 1] },
    { item_id: 'conqueror_will', weight: 7, qty: [1, 1] },
    { item_id: 'legion_insignia', weight: 2, qty: [1, 1] },
  ],
  fragmentum: [
    { item_id: 'inferno_core', weight: 66, qty: [1, 2] },
    { item_id: 'glimmering_core', weight: 25, qty: [1, 1] },
    { item_id: 'squirming_core', weight: 7, qty: [1, 1] },
    { item_id: 'fragmentum_heart', weight: 2, qty: [1, 1] },
  ],
  mechanical: [
    { item_id: 'ancient_part', weight: 66, qty: [1, 2] },
    { item_id: 'ancient_spindle', weight: 25, qty: [1, 1] },
    { item_id: 'ancient_engine', weight: 7, qty: [1, 1] },
    { item_id: 'ancient_quantum_core', weight: 2, qty: [1, 1] },
  ],
};

const CREDIT_DROPS: Array<{ min: number; max: number; weight: number }> = [
  { min: 300, max: 300, weight: 60 },
  { min: 500, max: 500, weight: 25 },
  { min: 1000, max: 1000, weight: 10 },
  { min: 2000, max: 2000, weight: 4 },
  { min: 5000, max: 5000, weight: 1 },
];

// Map enemy IDs to their material family for combat drops
const ENEMY_MATERIAL_FAMILIES: Record<string, string> = {
  voidranger_reaver: 'antimatter_legion',
  voidranger_distorter: 'antimatter_legion',
  voidranger_eliminator: 'antimatter_legion',
  voidranger_trampler: 'antimatter_legion',
  voidranger_ranger: 'antimatter_legion',
  voidranger_suppressor: 'antimatter_legion',
  antibodyon: 'antimatter_legion',
  baryon: 'antimatter_legion',
  imaginary_weaver: 'antimatter_legion',
  space_hound: 'antimatter_legion',
  imaginary_warp_trotter: 'antimatter_legion',
  flame_spawn: 'fragmentum',
  frost_spawn: 'fragmentum',
  lightning_spawn: 'fragmentum',
  wind_spawn: 'fragmentum',
  blaze_out_of_space: 'fragmentum',
  ice_out_of_space: 'fragmentum',
  incineration_shadewalker: 'fragmentum',
  frigid_prowler: 'fragmentum',
  automaton_beetle: 'mechanical',
  silvermane_cannonner: 'fragmentum',
  silvermane_soldier: 'fragmentum',
};

export function getHertaStationItems(locationId: string): Array<{ name: string; tag: string }> | null {
  return HERTA_STATION_ITEMS[locationId] || null;
}

export function rollTagRewards(tag: string): Array<{ item_id: string; quantity: number }> {
  const entries = ITEM_TAG_REWARDS[tag];
  if (!entries) return [{ item_id: 'credit', quantity: 50 }];
  const rewards: Array<{ item_id: string; quantity: number }> = [];
  for (const e of entries) {
    if (Math.random() * 100 < e.weight) {
      const qty = e.minQty + Math.floor(Math.random() * (e.maxQty - e.minQty + 1));
      rewards.push({ item_id: e.item_id, quantity: qty });
    }
  }
  return rewards.length > 0 ? rewards : [{ item_id: 'credit', quantity: 10 }];
}

export function rollMaterialDrop(family: string): { item_id: string; quantity: number } | null {
  const table = MATERIAL_DROP_FAMILIES[family];
  if (!table) return null;
  const totalWeight = table.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const e of table) {
    roll -= e.weight;
    if (roll <= 0) {
      const qty = e.qty[0] + Math.floor(Math.random() * (e.qty[1] - e.qty[0] + 1));
      return { item_id: e.item_id, quantity: qty };
    }
  }
  return null;
}

export function rollCreditDrop(): number {
  const totalWeight = CREDIT_DROPS.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const e of CREDIT_DROPS) {
    roll -= e.weight;
    if (roll <= 0) {
      return e.min + (e.max > e.min ? Math.floor(Math.random() * (e.max - e.min + 1)) : 0);
    }
  }
  return 300;
}

export function getEnemyMaterialFamily(enemyId: string): string | null {
  return ENEMY_MATERIAL_FAMILIES[enemyId] || null;
}

export function generateLocationResources(userId: string, slot: number, locationId: string, worldId: string): Array<{ id: string; name: string; tag: string }> {
  const hertaItems = getHertaStationItems(locationId);
  if (hertaItems) {
    return hertaItems.map((item, i) => ({
      id: item.name,
      name: item.name,
      tag: item.tag,
    }));
  }
  return [];
}

export function getEnemyFamiliesByLocation(locationId: string): any[] {
  return db.prepare('SELECT id, name, element FROM hsr_enemies WHERE location_id = ?').all(locationId);
}

export function generateEnemyFormations(locationId: string): Array<{ id: string; enemyIds: string[]; label: string }> {
  const enemies = getEnemyFamiliesByLocation(locationId);
  if (enemies.length === 0) return [];
  const shuffled = [...enemies].sort(() => Math.random() - 0.5);
  const formationCount = Math.min(Math.floor(Math.random() * 6), shuffled.length);
  const formations: Array<{ id: string; enemyIds: string[]; label: string }> = [];
  let used = new Set<number>();
  for (let i = 0; i < formationCount; i++) {
    const avail = shuffled.filter((_: any, idx: number) => !used.has(idx));
    if (avail.length === 0) break;
    const groupSize = 1 + Math.floor(Math.random() * Math.min(3, avail.length));
    const group: any[] = [];
    for (let g = 0; g < groupSize; g++) {
      const idx = Math.floor(Math.random() * avail.length);
      group.push(avail[idx]);
      used.add(shuffled.indexOf(avail[idx]));
      avail.splice(idx, 1);
      if (avail.length === 0) break;
    }
    if (group.length > 0) {
      formations.push({
        id: `formation_${locationId}_${i}`,
        enemyIds: group.map((e: any) => e.id),
        label: group.map((e: any) => e.name).join(', '),
      });
    }
  }
  return formations;
}

// ── Old search reward roll (moved into Gather) ──

export interface SearchReward {
  text: string;
  items?: Array<{ item_id: string; quantity: number }>;
  credits?: number;
  secret?: boolean;
}

export function rollOldSearchReward(): SearchReward {
  const roll = Math.random();
  if (roll < 0.4) {
    const credits = 10 + Math.floor(Math.random() * 41);
    return { text: `**${credits} Credits**`, items: [{ item_id: 'credit', quantity: credits }] };
  } else if (roll < 0.7) {
    return { text: '**Adventure Log ×1**', items: [{ item_id: 'adventure_log', quantity: 1 }] };
  } else if (roll < 0.9) {
    return { text: 'a **secret**', secret: true };
  } else {
    return { text: 'nothing of interest' };
  }
}

function seedResourceNodes() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_resource_nodes').get() as any;
  if (existing.c > 0) return;

  const insert = db.prepare('INSERT INTO hsr_resource_nodes (node_id, location_id, resource_item_id, quantity, gather_time_seconds) VALUES (?, ?, ?, ?, ?)');
  const nodes: Array<[string, string, string, number, number]> = [
    // Master Control Zone
    ['mcz_data_terminal', 'master_control_zone', 'thief_bell', 2, 30],
    ['mcz_research_console', 'master_control_zone', 'thief_bell', 1, 25],
    ['mcz_storage_rack', 'master_control_zone', 'thief_bell', 3, 35],
    ['mcz_comm_array', 'master_control_zone', 'thief_bell', 1, 20],
    ['mcz_exp_station', 'master_control_zone', 'thief_bell', 2, 30],
    ['mcz_emergency_locker', 'master_control_zone', 'relic_fragment', 1, 40],
    ['mcz_supply_cache', 'master_control_zone', 'adventure_log', 1, 30],
    // Base Zone
    ['bz_supply_depot', 'base_zone', 'thief_bell', 2, 25],
    ['bz_research_records', 'base_zone', 'thief_bell', 1, 20],
    ['bz_cafeteria_supplies', 'base_zone', 'thief_bell', 3, 30],
    ['bz_medical_station', 'base_zone', 'thief_bell', 1, 25],
    ['bz_maintenance_closet', 'base_zone', 'thief_bell', 2, 30],
    ['bz_personnel_locker', 'base_zone', 'adventure_log', 1, 35],
    ['bz_break_room_cache', 'base_zone', 'thief_bell', 2, 20],
    // Storage Zone
    ['sz_artifact_shelf', 'storage_zone', 'thief_bell', 2, 30],
    ['sz_research_crate', 'storage_zone', 'thief_bell', 1, 20],
    ['sz_forgotten_chest', 'storage_zone', 'relic_fragment', 1, 45],
    ['sz_archived_records', 'storage_zone', 'thief_bell', 3, 35],
    ['sz_equipment_rack', 'storage_zone', 'thief_bell', 2, 25],
    ['sz_sealed_container', 'storage_zone', 'adventure_log', 1, 30],
    ['sz_loose_debris', 'storage_zone', 'thief_bell', 1, 15],
    // Administrative District
    ['ad_supply_cache', 'administrative_district', 'inferno_core', 2, 30],
    ['ad_guard_post', 'administrative_district', 'inferno_core', 1, 25],
    ['ad_warmth_station', 'administrative_district', 'ancient_part', 1, 30],
    ['ad_archive_chest', 'administrative_district', 'inferno_core', 2, 35],
    ['ad_market_stall', 'administrative_district', 'inferno_core', 3, 30],
    ['ad_maintenance_supplies', 'administrative_district', 'ancient_part', 2, 25],
    ['ad_emergency_fund', 'administrative_district', 'credit', 50, 20],
    // Great Mine
    ['gm_ore_vein', 'great_mine', 'ancient_part', 2, 30],
    ['gm_mining_equipment', 'great_mine', 'inferno_core', 1, 25],
    ['gm_geothermal_vent', 'great_mine', 'inferno_core', 3, 35],
    ['gm_worker_locker', 'great_mine', 'inferno_core', 2, 30],
    ['gm_abandoned_cart', 'great_mine', 'ancient_part', 1, 20],
    ['gm_deep_tunnel_cache', 'great_mine', 'inferno_core', 2, 30],
    ['gm_crystal_formation', 'great_mine', 'relic_fragment', 1, 40],
    ['gm_explosive_stores', 'great_mine', 'inferno_core', 1, 25],
    // Rivet Town
    ['rt_abandoned_home', 'rivet_town', 'inferno_core', 2, 30],
    ['rt_outlaw_cache', 'rivet_town', 'ancient_part', 1, 25],
    ['rt_collapsed_building', 'rivet_town', 'inferno_core', 3, 35],
    ['rt_hidden_stash', 'rivet_town', 'inferno_core', 1, 20],
    ['rt_old_workshop', 'rivet_town', 'ancient_part', 2, 30],
    ['rt_rusted_container', 'rivet_town', 'inferno_core', 2, 25],
    ['rt_lookout_supplies', 'rivet_town', 'adventure_log', 1, 30],
    // Robot Settlement
    ['rs_machine_parts', 'robot_settlement', 'ancient_part', 2, 25],
    ['rs_charging_station', 'robot_settlement', 'inferno_core', 1, 30],
    ['rs_memory_bank', 'robot_settlement', 'inferno_core', 2, 35],
    ['rs_oil_reserve', 'robot_settlement', 'ancient_part', 1, 20],
    ['rs_tool_rack', 'robot_settlement', 'inferno_core', 2, 30],
    ['rs_circuit_board', 'robot_settlement', 'ancient_part', 1, 25],
    ['rs_power_core', 'robot_settlement', 'relic_fragment', 1, 40],
    ['rs_maintenance_bay', 'robot_settlement', 'inferno_core', 3, 30],
    // Backwater Pass
    ['bp_mountain_cache', 'backwater_pass', 'inferno_core', 2, 30],
    ['bp_frozen_supplies', 'backwater_pass', 'ancient_part', 1, 25],
    ['bp_cliffside_stash', 'backwater_pass', 'inferno_core', 2, 35],
    ['bp_shelter_crate', 'backwater_pass', 'inferno_core', 1, 20],
    ['bp_hidden_passage', 'backwater_pass', 'ancient_part', 2, 30],
    ['bp_watchtower_supplies', 'backwater_pass', 'inferno_core', 3, 30],
    ['bp_emergency_rations', 'backwater_pass', 'adventure_log', 1, 25],
    // Outlying Snow Plains
    ['osp_frozen_wreckage', 'outlying_snow_plains', 'inferno_core', 2, 30],
    ['osp_snow_cache', 'outlying_snow_plains', 'ancient_part', 1, 25],
    ['osp_ice_cave_supplies', 'outlying_snow_plains', 'inferno_core', 3, 35],
    ['osp_blizzard_shelter', 'outlying_snow_plains', 'inferno_core', 1, 20],
    ['osp_frozen_loot', 'outlying_snow_plains', 'ancient_part', 2, 30],
    ['osp_drifting_container', 'outlying_snow_plains', 'inferno_core', 2, 25],
    ['osp_expedition_cache', 'outlying_snow_plains', 'relic_fragment', 1, 40],
    ['osp_survival_stores', 'outlying_snow_plains', 'inferno_core', 1, 25],
    // Qlipoth Fort
    ['qf_fortification_supplies', 'qlipoth_fort', 'ancient_part', 2, 30],
    ['qf_armory_cache', 'qlipoth_fort', 'inferno_core', 1, 25],
    ['qf_guardian_locker', 'qlipoth_fort', 'inferno_core', 2, 35],
    ['qf_ancient_arsenal', 'qlipoth_fort', 'ancient_part', 1, 20],
    ['qf_war_room_records', 'qlipoth_fort', 'inferno_core', 3, 30],
    ['qf_preservation_cache', 'qlipoth_fort', 'relic_fragment', 1, 45],
    ['qf_fortress_stores', 'qlipoth_fort', 'inferno_core', 2, 30],
  ];

  db.transaction(() => {
    for (const n of nodes) {
      insert.run(...n);
    }
  })();
}

// ── Seed content ──

function seedQuests(): void {
  const quests = [
    {
      id: 'intro_01',
      title: 'First Steps',
      description: 'Take your first steps into the station and gather a few supplies.',
      quest_type: 'main',
      world_id: 'herta_space_station',
      location_id: 'master_control_zone',
      required_tb_level: 1,
      prerequisites: '[]',
      objectives: JSON.stringify([
        { type: 'explore_locations', target: 1, location_id: 'master_control_zone' },
        { type: 'gather_resources', target: 1 },
      ]),
      rewards: JSON.stringify({ credits: 150, trailblaze_xp: 50, items: [{ item_id: 'adventure_log', qty: 1 }] }),
      display_order: 1,
    },
    {
      id: 'intro_02',
      title: 'The First Encounter',
      description: 'Clear your first enemy formation and prove your party is ready.',
      quest_type: 'main',
      world_id: 'herta_space_station',
      location_id: 'master_control_zone',
      required_tb_level: 1,
      prerequisites: JSON.stringify(['intro_01']),
      objectives: JSON.stringify([{ type: 'defeat_enemies', target: 1 }]),
      rewards: JSON.stringify({ credits: 200, trailblaze_xp: 80, stellar_jade: 20 }),
      display_order: 2,
    },
    {
      id: 'intro_03',
      title: 'A Proper Crew',
      description: 'Recruit a companion and give them a starter piece of gear.',
      quest_type: 'main',
      world_id: 'herta_space_station',
      location_id: 'master_control_zone',
      required_tb_level: 1,
      prerequisites: JSON.stringify(['intro_02']),
      objectives: JSON.stringify([{ type: 'recruit_characters', target: 1 }]),
      rewards: JSON.stringify({ credits: 250, trailblaze_xp: 100, items: [{ item_id: 'travel_guide', qty: 1 }] }),
      display_order: 3,
    },
    {
      id: 'intro_04',
      title: 'The Daily Grind',
      description: 'Complete a daily commission and earn your keep.',
      quest_type: 'side',
      world_id: 'herta_space_station',
      location_id: 'master_control_zone',
      required_tb_level: 1,
      prerequisites: JSON.stringify(['intro_01']),
      objectives: JSON.stringify([{ type: 'complete_dailies', target: 1 }]),
      rewards: JSON.stringify({ credits: 180, trailblaze_xp: 60, stellar_jade: 10 }),
      display_order: 4,
    },
    {
      id: 'intro_05',
      title: 'Crafting Your Path',
      description: 'Use the Workshop to create a useful item for your journey.',
      quest_type: 'side',
      world_id: 'herta_space_station',
      location_id: 'master_control_zone',
      required_tb_level: 1,
      prerequisites: JSON.stringify(['intro_01']),
      objectives: JSON.stringify([{ type: 'craft_items', target: 1 }]),
      rewards: JSON.stringify({ credits: 220, trailblaze_xp: 70, items: [{ item_id: 'relic_fragment', qty: 1 }] }),
      display_order: 5,
    },
  ];

  const insert = db.prepare('INSERT OR IGNORE INTO hsr_quests (id, title, description, quest_type, world_id, location_id, required_tb_level, prerequisites, objectives, rewards, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    for (const quest of quests) {
      insert.run(quest.id, quest.title, quest.description, quest.quest_type, quest.world_id, quest.location_id, quest.required_tb_level, quest.prerequisites, quest.objectives, quest.rewards, quest.display_order);
    }
  })();
}

function seedAchievements(): void {
  const achievements = [
    { id: 'first_steps', title: 'First Steps', description: 'Complete your first main quest.', category: 'story', reward: JSON.stringify({ credits: 100 }) },
    { id: 'first_victory', title: 'First Victory', description: 'Defeat your first enemy formation.', category: 'combat', reward: JSON.stringify({ credits: 100 }) },
    { id: 'first_gear', title: 'Built for Battle', description: 'Equip your first piece of starter gear.', category: 'combat', reward: JSON.stringify({ credits: 120 }) },
    { id: 'resource_runner', title: 'Resource Runner', description: 'Gather your first resource node.', category: 'exploration', reward: JSON.stringify({ credits: 80 }) },
    { id: 'daily_runner', title: 'Daily Runner', description: 'Claim your first daily reward.', category: 'economy', reward: JSON.stringify({ credits: 120, stellar_jade: 5 }) },
  ];

  const columns = new Set(
    (db.prepare('PRAGMA table_info(hsr_achievements)').all() as Array<{ name: string }>).map((column) => column.name),
  );
  const insert = db.prepare(
    columns.has('name') && columns.has('rewards')
      ? 'INSERT OR IGNORE INTO hsr_achievements (id, name, description, category, rewards, hidden) VALUES (?, ?, ?, ?, ?, ?)' 
      : 'INSERT OR IGNORE INTO hsr_achievements (id, title, description, category, reward, hidden) VALUES (?, ?, ?, ?, ?, ?)',
  );

  db.transaction(() => {
    for (const achievement of achievements) {
      insert.run(achievement.id, achievement.title, achievement.description, achievement.category, achievement.reward, 0);
    }
  })();
}

// ── Initialize ──

initSchema();
seedPaths();
seedStarterCharacters();
seedWorlds();
seedLocations();
seedExpressRooms();
seedMaterials();
seedBanners();
seedCommissions();
seedEnemies();
seedResourceNodes();
seedQuests();
seedAchievements();

// ── Player query helpers ──

export interface SaveSlot {
  user_id: string;
  slot_number: number;
  traveler_name: string;
  express_name: string;
  pronouns: string;
  starting_path: string;
  created_at: string;
  last_played: string;
}

export interface PlayerState {
  user_id: string;
  slot_number: number;
  trailblaze_level: number;
  trailblaze_xp: number;
  trailblaze_power: number;
  trailblaze_power_max: number;
  trailblaze_power_last_refill: string;
  credits: number;
  stellar_jade: number;
  current_world: string;
  current_location: string;
  current_quest_id: string | null;
  cold_meter: number;
  cold_meter_max: number;
  created_at: string;
  last_active: string;
}

// Save slots
export function getSaveSlots(userId: string): SaveSlot[] {
  return db.prepare('SELECT * FROM hsr_save_slots WHERE user_id = ? ORDER BY slot_number').all(userId) as SaveSlot[];
}

export function getSaveSlot(userId: string, slot: number): SaveSlot | undefined {
  return db.prepare('SELECT * FROM hsr_save_slots WHERE user_id = ? AND slot_number = ?').get(userId, slot) as SaveSlot | undefined;
}

export function createSaveSlot(userId: string, slot: number, data: { traveler_name: string; express_name: string; pronouns: string; starting_path: string }): void {
  db.prepare(`INSERT INTO hsr_save_slots (user_id, slot_number, traveler_name, express_name, pronouns, starting_path) VALUES (?, ?, ?, ?, ?, ?)`).run(userId, slot, data.traveler_name, data.express_name, data.pronouns, data.starting_path);
}

export function updateLastPlayed(userId: string, slot: number): void {
  db.prepare("UPDATE hsr_save_slots SET last_played = datetime('now') WHERE user_id = ? AND slot_number = ?").run(userId, slot);
}

export function deleteSaveSlot(userId: string, slot: number): void {
  db.transaction(() => {
    db.prepare('DELETE FROM hsr_gathered_resources WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_player_dailies WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_simulated_universe WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_warp_history WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_pity WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_relics WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_light_cones WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_inventory WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_player_achievements WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_player_quests WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_discovered_locations WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_player_express WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_reputation WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_player_characters WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_players WHERE user_id = ? AND slot_number = ?').run(userId, slot);
    db.prepare('DELETE FROM hsr_save_slots WHERE user_id = ? AND slot_number = ?').run(userId, slot);
  })();
}

// Player state
export function getPlayer(userId: string, slot: number): PlayerState | undefined {
  return db.prepare('SELECT * FROM hsr_players WHERE user_id = ? AND slot_number = ?').get(userId, slot) as PlayerState | undefined;
}

export function createPlayer(userId: string, slot: number, startingPath: string, startingLocation: string): void {
  db.prepare(`INSERT INTO hsr_players (user_id, slot_number, current_world, current_location, credits, stellar_jade)
    VALUES (?, ?, 'herta_space_station', ?, 200, 500)`).run(userId, slot, startingLocation);
  ensureStarterQuest(userId, slot);
}

// Path data
export function getPath(pathId: string): any {
  return db.prepare('SELECT * FROM hsr_paths WHERE id = ?').get(pathId);
}

// Character data
export function getAllCharacters(): any[] {
  return db.prepare('SELECT * FROM hsr_characters').all();
}

export function getCharacter(charId: string): any {
  return db.prepare('SELECT * FROM hsr_characters WHERE id = ?').get(charId);
}

export function getPlayerCharacters(userId: string, slot: number): any[] {
  return db.prepare(`SELECT pc.*, c.name, c.path, c.element, c.rarity, c.base_hp, c.base_atk, c.base_def, c.base_speed, c.taunt_value, c.skill_description, c.ultimate_description, c.talent_description
    FROM hsr_player_characters pc JOIN hsr_characters c ON pc.character_id = c.id WHERE pc.user_id = ? AND pc.slot_number = ? ORDER BY pc.party_slot`).all(userId, slot);
}

export function getParty(userId: string, slot: number): any[] {
  return db.prepare(`SELECT pc.*, c.name, c.path, c.element, c.rarity, c.base_hp, c.base_atk, c.base_def, c.base_speed, c.taunt_value, c.skill_description, c.ultimate_description, c.talent_description
    FROM hsr_player_characters pc JOIN hsr_characters c ON pc.character_id = c.id WHERE pc.user_id = ? AND pc.slot_number = ? AND pc.equipped = 1 ORDER BY pc.party_slot`).all(userId, slot);
}

function ensureCharacterReference(charId: string): void {
  const existing = db.prepare('SELECT 1 FROM hsr_characters WHERE id = ?').get(charId) as any;
  if (existing) return;

  const name = charId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  db.prepare(`INSERT INTO hsr_characters (id, name, path, element, rarity, base_hp, base_atk, base_def, base_speed, taunt_value, is_free, obtain_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'warp')`).run(charId, name, 'destruction', 'physical', 4, 100, 50, 40, 100, 100);
}

export function addCharacterToPlayer(userId: string, slot: number, charId: string): void {
  ensureCharacterReference(charId);

  const count = db.prepare('SELECT COUNT(*) as c FROM hsr_player_characters WHERE user_id = ? AND slot_number = ? AND character_id = ?').get(userId, slot, charId) as any;
  if (count.c > 0) return;
  const partyCount = (db.prepare('SELECT COUNT(*) as c FROM hsr_player_characters WHERE user_id = ? AND slot_number = ? AND equipped = 1').get(userId, slot) as any).c;
  db.prepare(`INSERT INTO hsr_player_characters (user_id, slot_number, character_id, equipped, party_slot)
    VALUES (?, ?, ?, ?, ?)`).run(userId, slot, charId, partyCount < 4 ? 1 : 0, partyCount < 4 ? partyCount + 1 : null);

  const char = getCharacter(charId);
  const charName = char?.name ?? charId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const coneExists = db.prepare('SELECT 1 FROM hsr_light_cones WHERE user_id = ? AND slot_number = ? AND character_id = ?').get(userId, slot, charId) as any;
  if (!coneExists) {
    db.prepare('INSERT INTO hsr_light_cones (user_id, slot_number, character_id, name, level, ascension, superimpose) VALUES (?, ?, ?, ?, 1, 0, 1)').run(userId, slot, charId, `${charName} Starter Cone`);
  }
  const relicExists = db.prepare('SELECT 1 FROM hsr_relics WHERE user_id = ? AND slot_number = ? AND character_id = ?').get(userId, slot, charId) as any;
  if (!relicExists) {
    db.prepare('INSERT INTO hsr_relics (user_id, slot_number, character_id, set_name, piece_type, rarity, level, main_stat, sub_stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(userId, slot, charId, 'Scout of the Past', 'body', 3, 0, '{}', '[]');
  }
  advanceQuest(userId, slot, 'recruit_characters');
  unlockAchievement(userId, slot, 'first_gear');
}

// Quest progress
export function getActiveQuests(userId: string, slot: number): any[] {
  return db.prepare(`SELECT pq.*, q.title, q.description, q.quest_type, q.objectives, q.rewards, q.choices
    FROM hsr_player_quests pq JOIN hsr_quests q ON pq.quest_id = q.id
    WHERE pq.user_id = ? AND pq.slot_number = ? AND pq.status = 'active'`).all(userId, slot);
}

export function getPlayerQuestEntries(userId: string, slot: number): any[] {
  return db.prepare(`SELECT pq.*, q.title, q.description, q.quest_type, q.objectives, q.rewards, q.choices
    FROM hsr_player_quests pq JOIN hsr_quests q ON pq.quest_id = q.id
    WHERE pq.user_id = ? AND pq.slot_number = ? ORDER BY pq.status = 'active' DESC, q.display_order ASC`).all(userId, slot);
}

export function ensureStarterQuest(userId: string, slot: number): void {
  const exists = db.prepare('SELECT 1 FROM hsr_player_quests WHERE user_id = ? AND slot_number = ? AND quest_id = ?').get(userId, slot, 'intro_01') as any;
  if (exists) return;
  db.prepare('INSERT INTO hsr_player_quests (user_id, slot_number, quest_id, status) VALUES (?, ?, ?, ?)').run(userId, slot, 'intro_01', 'active');
  db.prepare('UPDATE hsr_players SET current_quest_id = ? WHERE user_id = ? AND slot_number = ?').run('intro_01', userId, slot);
}

export function completeQuest(userId: string, slot: number, questId: string): void {
  const quest = db.prepare('SELECT * FROM hsr_quests WHERE id = ?').get(questId) as any;
  if (!quest) return;
  const existing = db.prepare('SELECT status FROM hsr_player_quests WHERE user_id = ? AND slot_number = ? AND quest_id = ?').get(userId, slot, questId) as any;
  if (!existing || existing.status === 'completed') return;

  if (quest.rewards) {
    try {
      const rewards = JSON.parse(quest.rewards);
      if (rewards.credits) addCredits(userId, slot, rewards.credits);
      if (rewards.stellar_jade) addJade(userId, slot, rewards.stellar_jade);
      if (rewards.trailblaze_xp) addTrailblazeXp(userId, slot, rewards.trailblaze_xp);
      if (rewards.items) {
        for (const item of rewards.items) {
          addItem(userId, slot, item.item_id, item.qty);
        }
      }
    } catch {}
  }

  db.prepare("UPDATE hsr_player_quests SET status = 'completed', completed_at = datetime('now') WHERE user_id = ? AND slot_number = ? AND quest_id = ?").run(userId, slot, questId);
  unlockAchievement(userId, slot, questId === 'intro_01' ? 'first_steps' : 'first_victory');
}

export function advanceQuest(userId: string, slot: number, objectiveType: string, extra?: any): void {
  const activeQuests = getActiveQuests(userId, slot);
  if (!activeQuests.length) return;

  for (const quest of activeQuests) {
    let objectiveProgress: any[] = [];
    try { objectiveProgress = JSON.parse(quest.objective_progress || '[]'); } catch {}

    const objectives = JSON.parse(quest.objectives || '[]');
    let changed = false;

    for (const objective of objectives) {
      if (objective.type !== objectiveType) continue;
      if (objective.type === 'explore_locations' && extra?.location_id && objective.location_id && objective.location_id !== extra.location_id) continue;

      let entry = objectiveProgress.find((p: any) => p.type === objective.type);
      if (!entry) {
        entry = { type: objective.type, count: 0, complete: false };
        objectiveProgress.push(entry);
      }

      entry.count = (entry.count || 0) + 1;
      if (entry.count >= (objective.target || 1)) entry.complete = true;
      changed = true;
    }

    if (changed) {
      db.prepare('UPDATE hsr_player_quests SET objective_progress = ? WHERE user_id = ? AND slot_number = ? AND quest_id = ?').run(JSON.stringify(objectiveProgress), userId, slot, quest.quest_id);
      const allComplete = objectives.every((objective: any) => {
        const entry = objectiveProgress.find((p: any) => p.type === objective.type);
        return entry?.complete || (entry?.count || 0) >= (objective.target || 1);
      });
      if (allComplete) {
        completeQuest(userId, slot, quest.quest_id);
      }
    }
  }
}

// Currency operations
export function getCurrencies(userId: string, slot: number): { credits: number; stellar_jade: number; trailblaze_power: number; trailblaze_power_max: number } {
  const p = getPlayer(userId, slot);
  if (!p) return { credits: 0, stellar_jade: 0, trailblaze_power: 0, trailblaze_power_max: 240 };
  return { credits: p.credits, stellar_jade: p.stellar_jade, trailblaze_power: p.trailblaze_power, trailblaze_power_max: p.trailblaze_power_max };
}

export function addCredits(userId: string, slot: number, amount: number): void {
  db.prepare('UPDATE hsr_players SET credits = max(0, credits + ?) WHERE user_id = ? AND slot_number = ?').run(amount, userId, slot);
}

export function addJade(userId: string, slot: number, amount: number): void {
  db.prepare('UPDATE hsr_players SET stellar_jade = max(0, stellar_jade + ?) WHERE user_id = ? AND slot_number = ?').run(amount, userId, slot);
}

export function spendJade(userId: string, slot: number, amount: number): boolean {
  const p = getPlayer(userId, slot);
  if (!p || p.stellar_jade < amount) return false;
  db.prepare('UPDATE hsr_players SET stellar_jade = stellar_jade - ? WHERE user_id = ? AND slot_number = ?').run(amount, userId, slot);
  return true;
}

// Exp/Leveling
export function addTrailblazeXp(userId: string, slot: number, amount: number): { leveled: boolean; newLevel: number } {
  const p = getPlayer(userId, slot);
  if (!p) return { leveled: false, newLevel: 1 };
  const flatPerLevel = 100;
  const newXp = p.trailblaze_xp + amount;
  const xpForLevel = p.trailblaze_level * flatPerLevel;
  if (newXp >= xpForLevel) {
    const leftover = newXp - xpForLevel;
    db.prepare('UPDATE hsr_players SET trailblaze_level = trailblaze_level + 1, trailblaze_xp = ? WHERE user_id = ? AND slot_number = ?').run(leftover, userId, slot);
    return { leveled: true, newLevel: p.trailblaze_level + 1 };
  }
  db.prepare('UPDATE hsr_players SET trailblaze_xp = ? WHERE user_id = ? AND slot_number = ?').run(newXp, userId, slot);
  return { leveled: false, newLevel: p.trailblaze_level };
}

// Trailblaze Power refill
export function refillTrailblazePower(userId: string, slot: number): void {
  const p = getPlayer(userId, slot);
  if (!p) return;
  const elapsed = (Date.now() - new Date(p.trailblaze_power_last_refill).getTime()) / 60000;
  const gained = Math.floor(elapsed / 6);
  if (gained > 0) {
    const newPower = Math.min(p.trailblaze_power_max, p.trailblaze_power + gained);
    db.prepare("UPDATE hsr_players SET trailblaze_power = ?, trailblaze_power_last_refill = datetime('now') WHERE user_id = ? AND slot_number = ?").run(newPower, userId, slot);
  }
}

export function spendTrailblazePower(userId: string, slot: number, amount: number): boolean {
  refillTrailblazePower(userId, slot);
  const p = getPlayer(userId, slot);
  if (!p || p.trailblaze_power < amount) return false;
  db.prepare('UPDATE hsr_players SET trailblaze_power = trailblaze_power - ? WHERE user_id = ? AND slot_number = ?').run(amount, userId, slot);
  return true;
}

// Locations
export function getLocation(locId: string): any {
  return db.prepare('SELECT * FROM hsr_locations WHERE id = ?').get(locId);
}

export function getWorldLocations(worldId: string): any[] {
  return db.prepare('SELECT * FROM hsr_locations WHERE world_id = ? ORDER BY location_type, id').all(worldId);
}

export function discoverLocation(userId: string, slot: number, locId: string): void {
  db.prepare('INSERT OR IGNORE INTO hsr_discovered_locations (user_id, slot_number, location_id) VALUES (?, ?, ?)').run(userId, slot, locId);
  db.prepare('UPDATE hsr_discovered_locations SET explored = 1 WHERE user_id = ? AND slot_number = ? AND location_id = ?').run(userId, slot, locId);
}

export function movePlayer(userId: string, slot: number, locId: string): void {
  const loc = getLocation(locId);
  if (!loc) return;
  db.prepare('UPDATE hsr_players SET current_location = ?, current_world = ? WHERE user_id = ? AND slot_number = ?').run(locId, loc.world_id, userId, slot);
  discoverLocation(userId, slot, locId);
}

// World data
export function getWorld(worldId: string): any {
  return db.prepare('SELECT * FROM hsr_worlds WHERE id = ?').get(worldId);
}

// Express
export function getPlayerExpress(userId: string, slot: number): any[] {
  return db.prepare(`SELECT pe.*, r.name, r.description, r.max_level, r.base_production, r.upgrade_costs
    FROM hsr_player_express pe JOIN hsr_express_rooms r ON pe.room_id = r.room_id WHERE pe.user_id = ? AND pe.slot_number = ?`).all(userId, slot);
}

export function createDefaultExpress(userId: string, slot: number): void {
  const rooms = db.prepare('SELECT room_id FROM hsr_express_rooms').all() as any[];
  const insert = db.prepare('INSERT OR IGNORE INTO hsr_player_express (user_id, slot_number, room_id, level) VALUES (?, ?, ?, 1)');
  db.transaction(() => {
    for (const r of rooms) {
      insert.run(userId, slot, r.room_id);
    }
  })();
}

// Dailies
export function getDailyProgress(userId: string, slot: number): number {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare('SELECT COUNT(*) as c FROM hsr_player_dailies WHERE user_id = ? AND slot_number = ? AND date = ? AND completed = 1').get(userId, slot, today) as any;
  return row?.c ?? 0;
}

export function getTodaysDailies(userId: string, slot: number): any[] {
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare(`SELECT pd.*, dc.description, dc.commission_type, dc.objectives, dc.rewards, dc.location_id
    FROM hsr_player_dailies pd JOIN hsr_daily_commissions dc ON pd.commission_id = dc.id
    WHERE pd.user_id = ? AND pd.slot_number = ? AND pd.date = ?`).all(userId, slot, today);
}

export function assignDaily(userId: string, slot: number, commissionId: string, extraProgress?: any[]): void {
  const today = new Date().toISOString().slice(0, 10);
  const exists = db.prepare('SELECT COUNT(*) as c FROM hsr_player_dailies WHERE user_id = ? AND slot_number = ? AND date = ? AND commission_id = ?').get(userId, slot, today, commissionId) as any;
  if (exists.c === 0) {
    const progress = extraProgress ? JSON.stringify(extraProgress) : '[]';
    db.prepare('INSERT INTO hsr_player_dailies (user_id, slot_number, date, commission_id, progress) VALUES (?, ?, ?, ?, ?)').run(userId, slot, today, commissionId, progress);
  }
}

// Reputation
export function getReputation(userId: string, slot: number, worldId: string): number {
  const row = db.prepare('SELECT reputation FROM hsr_reputation WHERE user_id = ? AND slot_number = ? AND world_id = ?').get(userId, slot, worldId) as any;
  return row?.reputation ?? 0;
}

export function addReputation(userId: string, slot: number, worldId: string, amount: number): number {
  db.prepare('INSERT OR IGNORE INTO hsr_reputation (user_id, slot_number, world_id, reputation) VALUES (?, ?, ?, 0)').run(userId, slot, worldId);
  db.prepare('UPDATE hsr_reputation SET reputation = reputation + ? WHERE user_id = ? AND slot_number = ? AND world_id = ?').run(amount, userId, slot, worldId);
  const row = db.prepare('SELECT reputation FROM hsr_reputation WHERE user_id = ? AND slot_number = ? AND world_id = ?').get(userId, slot, worldId) as any;
  return row?.reputation ?? 0;
}

// Achievements
export function getAchievementsByCategory(userId: string, slot: number, category: string): any[] {
  return db.prepare(`SELECT a.*, COALESCE(pa.unlocked, 0) as unlocked, pa.unlocked_at
    FROM hsr_achievements a LEFT JOIN hsr_player_achievements pa ON a.id = pa.achievement_id AND pa.user_id = ? AND pa.slot_number = ?
    WHERE a.category = ? ORDER BY a.id`).all(userId, slot, category);
}

export function unlockAchievement(userId: string, slot: number, achievementId: string): boolean {
  const existing = db.prepare('SELECT unlocked FROM hsr_player_achievements WHERE user_id = ? AND slot_number = ? AND achievement_id = ?').get(userId, slot, achievementId) as any;
  if (existing?.unlocked) return false;
  db.prepare(`INSERT OR REPLACE INTO hsr_player_achievements (user_id, slot_number, achievement_id, unlocked, unlocked_at) VALUES (?, ?, ?, 1, datetime('now'))`).run(userId, slot, achievementId);
  return true;
}

// Inventory
export function getInventory(userId: string, slot: number): any[] {
  return db.prepare(`SELECT i.*, m.name, m.type, m.rarity, m.description
    FROM hsr_inventory i JOIN hsr_materials m ON i.item_id = m.item_id WHERE i.user_id = ? AND i.slot_number = ? AND i.quantity > 0 ORDER BY m.rarity DESC, i.item_id`).all(userId, slot);
}

export function addItem(userId: string, slot: number, itemId: string, qty: number): void {
  db.prepare('INSERT OR IGNORE INTO hsr_inventory (user_id, slot_number, item_id, quantity) VALUES (?, ?, ?, 0)').run(userId, slot, itemId);
  db.prepare('UPDATE hsr_inventory SET quantity = quantity + ? WHERE user_id = ? AND slot_number = ? AND item_id = ?').run(qty, userId, slot, itemId);
}

export function removeItem(userId: string, slot: number, itemId: string, qty: number): boolean {
  const row = db.prepare('SELECT quantity FROM hsr_inventory WHERE user_id = ? AND slot_number = ? AND item_id = ?').get(userId, slot, itemId) as any;
  if (!row || row.quantity < qty) return false;
  db.prepare('UPDATE hsr_inventory SET quantity = quantity - ? WHERE user_id = ? AND slot_number = ? AND item_id = ?').run(qty, userId, slot, itemId);
  return true;
}

// Progression gates
export function getRequiredDiscordLevel(feature: string): number {
  const row = db.prepare('SELECT discord_level FROM hsr_progression_gates WHERE feature_name = ?').get(feature) as any;
  return row?.discord_level ?? 0;
}

// Discovered locations
export function getDiscoveredLocations(userId: string, slot: number): any[] {
  return db.prepare('SELECT * FROM hsr_discovered_locations WHERE user_id = ? AND slot_number = ? ORDER BY location_id').all(userId, slot);
}

export function updateColdMeter(userId: string, slot: number, value: number): void {
  db.prepare('UPDATE hsr_players SET cold_meter = ? WHERE user_id = ? AND slot_number = ?').run(value, userId, slot);
}

export function addColdMeter(userId: string, slot: number, amount: number): void {
  db.prepare('UPDATE hsr_players SET cold_meter = MAX(0, MIN(cold_meter_max, cold_meter + ?)) WHERE user_id = ? AND slot_number = ?').run(amount, userId, slot);
}

// Resource nodes
export function getResourceNodesForLocation(locationId: string): any[] {
  return db.prepare('SELECT * FROM hsr_resource_nodes WHERE location_id = ?').all(locationId);
}

export function getMaterialName(itemId: string): string {
  const row = db.prepare('SELECT name FROM hsr_materials WHERE item_id = ?').get(itemId) as any;
  return row?.name ?? itemId;
}

export function getLocationsByWorld(worldId: string): any[] {
  return db.prepare('SELECT id, name FROM hsr_locations WHERE world_id = ?').all(worldId);
}

// Daily Commission management
export function getAllCommissions(): any[] {
  return db.prepare('SELECT * FROM hsr_daily_commissions').all();
}

export function completeDaily(userId: string, slot: number, commissionId: string): void {
  db.prepare("UPDATE hsr_player_dailies SET completed = 1, progress = json('[]') WHERE user_id = ? AND slot_number = ? AND date = date('now') AND commission_id = ?").run(userId, slot, commissionId);
}

export function getTodaysIncompleteByType(userId: string, slot: number, commissionType: string): any[] {
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare(`SELECT pd.*, dc.description, dc.commission_type, dc.objectives, dc.rewards, dc.location_id
    FROM hsr_player_dailies pd JOIN hsr_daily_commissions dc ON pd.commission_id = dc.id
    WHERE pd.user_id = ? AND pd.slot_number = ? AND pd.date = ? AND pd.completed = 0 AND dc.commission_type = ?`).all(userId, slot, today, commissionType);
}

export function clearTodaysDailies(userId: string, slot: number): void {
  db.prepare("DELETE FROM hsr_player_dailies WHERE user_id = ? AND slot_number = ? AND date = date('now')").run(userId, slot);
}

export function autoAssignDailies(userId: string, slot: number): void {
  const player = getPlayer(userId, slot);
  if (!player) return;

  const today = new Date().toISOString().slice(0, 10);
  const existing = db.prepare('SELECT COUNT(*) as c FROM hsr_player_dailies WHERE user_id = ? AND slot_number = ? AND date = ?').get(userId, slot, today) as any;
  if (existing.c > 0) return;

  const all = getAllCommissions();
  const available = all.filter((c: any) => c.min_tb_level <= player.trailblaze_level);
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 4);

  const worldLocs = player.current_world ? getLocationsByWorld(player.current_world) : [];

  const assign = db.transaction(() => {
    for (const c of selected) {
      if (c.commission_type === 'deliver' && worldLocs.length > 0) {
        const target = worldLocs[Math.floor(Math.random() * worldLocs.length)];
        assignDaily(userId, slot, c.id, [{ deliver_to_location: target.id }]);
      } else {
        assignDaily(userId, slot, c.id);
      }
    }
  });
  assign();
}

// Express room reference
export function getExpressRoom(roomId: string): any {
  return db.prepare('SELECT * FROM hsr_express_rooms WHERE room_id = ?').get(roomId);
}

export function getAllExpressRooms(): any[] {
  return db.prepare('SELECT * FROM hsr_express_rooms').all();
}

export function upgradeExpressRoom(userId: string, slot: number, roomId: string): boolean {
  const result = db.prepare(
    'UPDATE hsr_player_express SET level = level + 1 WHERE user_id=? AND slot_number=? AND room_id=? AND level < (SELECT max_level FROM hsr_express_rooms WHERE room_id=?)'
  ).run(userId, slot, roomId, roomId);
  return result.changes > 0;
}

// Enemies
export function getEnemy(enemyId: string): any {
  return db.prepare('SELECT * FROM hsr_enemies WHERE id = ?').get(enemyId);
}

export function getEnemiesByLocation(locationId: string): any[] {
  return db.prepare('SELECT * FROM hsr_enemies WHERE location_id = ?').all(locationId);
}

// ── Warp System ──

export function getActiveBanners(): any[] {
  return db.prepare('SELECT * FROM hsr_warp_banners WHERE is_active = 1').all();
}

export function getWarpBanner(bannerId: string): any {
  return db.prepare('SELECT * FROM hsr_warp_banners WHERE id = ?').get(bannerId);
}

export function getPity(userId: string, slot: number, bannerId: string): { pity_5: number; pity_4: number; guaranteed_5: number; guaranteed_4: number; total_pulls: number } {
  db.prepare('INSERT OR IGNORE INTO hsr_pity (user_id, slot_number, banner_id) VALUES (?, ?, ?)').run(userId, slot, bannerId);
  return db.prepare('SELECT pity_5, pity_4, guaranteed_5, guaranteed_4, total_pulls FROM hsr_pity WHERE user_id = ? AND slot_number = ? AND banner_id = ?').get(userId, slot, bannerId) as any;
}

export function updatePity(userId: string, slot: number, bannerId: string, data: { pity_5: number; pity_4: number; guaranteed_5: number; guaranteed_4: number }): void {
  db.prepare('UPDATE hsr_pity SET pity_5 = ?, pity_4 = ?, guaranteed_5 = ?, guaranteed_4 = ?, total_pulls = total_pulls + 1 WHERE user_id = ? AND slot_number = ? AND banner_id = ?')
    .run(data.pity_5, data.pity_4, data.guaranteed_5, data.guaranteed_4, userId, slot, bannerId);
}

export function addWarpHistory(userId: string, slot: number, bannerId: string, characterId: string, rarity: number, pullNumber: number): void {
  db.prepare('INSERT INTO hsr_warp_history (user_id, slot_number, banner_id, character_id, rarity, pull_number) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, slot, bannerId, characterId, rarity, pullNumber);
}

export function getWarpHistory(userId: string, slot: number, bannerId: string, limit: number): any[] {
  return db.prepare('SELECT * FROM hsr_warp_history WHERE user_id = ? AND slot_number = ? AND banner_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?').all(userId, slot, bannerId, limit);
}

// ── Team Management ──

export function getPlayerRoster(userId: string, slot: number): any[] {
  return db.prepare(`SELECT pc.*, c.name, c.path, c.element, c.rarity, c.base_hp, c.base_atk, c.base_def, c.base_speed, c.taunt_value
    FROM hsr_player_characters pc JOIN hsr_characters c ON pc.character_id = c.id
    WHERE pc.user_id = ? AND pc.slot_number = ? ORDER BY pc.equipped DESC, pc.party_slot ASC, c.rarity DESC`).all(userId, slot);
}

export function setPartySlot(userId: string, slot: number, charId: string, partySlot: number): boolean {
  if (partySlot < 1 || partySlot > 4) return false;
  const owned = db.prepare('SELECT 1 FROM hsr_player_characters WHERE user_id = ? AND slot_number = ? AND character_id = ?').get(userId, slot, charId) as any;
  if (!owned) return false;
  const existing = db.prepare('SELECT character_id FROM hsr_player_characters WHERE user_id = ? AND slot_number = ? AND equipped = 1 AND party_slot = ?').get(userId, slot, partySlot) as any;
  if (existing && existing.character_id !== charId) {
    db.prepare('UPDATE hsr_player_characters SET equipped = 0, party_slot = NULL WHERE user_id = ? AND slot_number = ? AND character_id = ?').run(userId, slot, existing.character_id);
  }
  db.prepare('UPDATE hsr_player_characters SET equipped = 1, party_slot = ? WHERE user_id = ? AND slot_number = ? AND character_id = ?').run(partySlot, userId, slot, charId);
  return true;
}

export function unequipCharacter(userId: string, slot: number, charId: string): boolean {
  const owned = db.prepare('SELECT 1 FROM hsr_player_characters WHERE user_id = ? AND slot_number = ? AND character_id = ? AND equipped = 1').get(userId, slot, charId) as any;
  if (!owned) return false;
  db.prepare('UPDATE hsr_player_characters SET equipped = 0, party_slot = NULL WHERE user_id = ? AND slot_number = ? AND character_id = ?').run(userId, slot, charId);
  return true;
}

// ── Relic Management ──

export function getPlayerRelics(userId: string, slot: number): any[] {
  return db.prepare('SELECT * FROM hsr_relics WHERE user_id = ? AND slot_number = ? ORDER BY rarity DESC, level DESC').all(userId, slot);
}

export function getCharacterRelics(userId: string, slot: number, charId: string): any[] {
  return db.prepare('SELECT * FROM hsr_relics WHERE user_id = ? AND slot_number = ? AND character_id = ? ORDER BY piece_type').all(userId, slot, charId);
}

export function getRelicById(relicId: number): any {
  return db.prepare('SELECT * FROM hsr_relics WHERE id = ?').get(relicId);
}

export function equipRelic(userId: string, slot: number, relicId: number, charId: string): boolean {
  const relic = db.prepare('SELECT * FROM hsr_relics WHERE id = ? AND user_id = ? AND slot_number = ?').get(relicId, userId, slot) as any;
  if (!relic) return false;
  const existing = db.prepare('SELECT id FROM hsr_relics WHERE user_id = ? AND slot_number = ? AND character_id = ? AND piece_type = ?').get(userId, slot, charId, relic.piece_type) as any;
  if (existing) {
    db.prepare('UPDATE hsr_relics SET character_id = NULL WHERE id = ?').run(existing.id);
  }
  db.prepare('UPDATE hsr_relics SET character_id = ? WHERE id = ?').run(charId, relicId);
  return true;
}

export function unequipRelic(userId: string, slot: number, relicId: number): boolean {
  const owned = db.prepare('SELECT 1 FROM hsr_relics WHERE id = ? AND user_id = ? AND slot_number = ?').get(relicId, userId, slot) as any;
  if (!owned) return false;
  db.prepare('UPDATE hsr_relics SET character_id = NULL WHERE id = ?').run(relicId);
  return true;
}

export function addRelic(userId: string, slot: number, data: { set_name: string; piece_type: string; rarity: number; main_stat: string; sub_stats: string }): number {
  const result = db.prepare('INSERT INTO hsr_relics (user_id, slot_number, set_name, piece_type, rarity, level, main_stat, sub_stats) VALUES (?, ?, ?, ?, ?, 0, ?, ?)').run(userId, slot, data.set_name, data.piece_type, data.rarity, data.main_stat, data.sub_stats);
  return Number(result.lastInsertRowid);
}

// ── Re-export the db instance for direct use if needed ──
export { db };
