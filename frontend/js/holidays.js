/**
 * PETTR Automatic Festive Holiday Theme Engine (v13.4)
 * Mirrors the calendar holiday registry across Dashboard UI Crests plus Nature, Gateway, and Deep Blue worlds,
 * adding world-authentic, atmospheric, battery-conscious seasonal overlays year-round.
 */
const HolidayThemes = {
  MAJOR_HOLIDAYS: {
    "1-1": {
      id: "new_year", family: "new_year", name: "New Year's Day", icon: "✨",
      kicker: "First Light", tagline: "First light of a bright new year.",
      accent: "250, 204, 21", secondary: "56, 189, 248", tertiary: "244, 114, 182",
      decorations: ["✨", "🥂", "🎆", "🌟"],
      funFacts: [
        "Julius Caesar established January 1 as the start of the civic year in 46 BCE, honouring Janus — the Roman god of doorways and new beginnings.",
        "Kiribati's Line Islands in the Pacific greet every New Year first, while American Samoa welcomes it a full 25 hours later.",
        "Around the world, eating round foods — like grapes in Spain or rice cakes in East Asia — symbolises continuity and good fortune."
      ]
    },
    "2-14": {
      id: "valentines", family: "valentines", name: "Valentine's Day", icon: "💖",
      kicker: "Hearts & Roses", tagline: "Warmth, roses, and cherished company.",
      accent: "244, 114, 182", secondary: "251, 113, 133", tertiary: "253, 164, 175",
      decorations: ["🌹", "💖", "✨", "💌"],
      funFacts: [
        "The oldest surviving Valentine's love poem was written in 1415 by Charles, Duke of Orléans, to his wife while imprisoned in the Tower of London.",
        "Richard Cadbury created the very first heart-shaped box of chocolates for Valentine's Day in 1861 — designed to store love letters afterward.",
        "In Finland and Estonia, February 14 is celebrated as 'Friend's Day' (Ystävänpäivä / Sõbrapäev), honouring friendships as much as romance."
      ]
    },
    "3-17": {
      id: "st_patricks", family: "st_patricks", name: "St. Patrick's Day", icon: "☘️",
      kicker: "Emerald Folklore", tagline: "Emerald clovers and cheerful good fortune.",
      accent: "16, 185, 129", secondary: "250, 204, 21", tertiary: "52, 211, 153",
      decorations: ["☘️", "🌈", "🪙", "✨"],
      funFacts: [
        "The colour originally linked with St. Patrick was 'St. Patrick's Blue' — green became the global emblem later during 18th-century Irish movements.",
        "The first St. Patrick's Day parade didn't take place in Ireland — it was marched in St. Augustine, Florida in 1601, before Dublin's first parade in 1931.",
        "The botanical chances of finding a genuine four-leaf clover are roughly 1 in 5,000, making each extra leaflet a traditional token of luck."
      ]
    },
    "4-22": {
      id: "earth_day", family: "earth_day", name: "Earth Day", icon: "🌍",
      kicker: "Blue Planet", tagline: "Wild forests, open skies, and living oceans.",
      accent: "16, 185, 129", secondary: "56, 189, 248", tertiary: "45, 212, 191",
      decorations: ["🌍", "🌿", "🐋", "✨"],
      funFacts: [
        "When Earth Day launched on April 22, 1970, 20 million people took part in rallies and cleanups — roughly 10% of the entire United States population at the time.",
        "Over 71% of Earth's surface is ocean, and marine phytoplankton quietly generate about half of the oxygen in every breath we take.",
        "The Paris Climate Agreement was formally opened for signature on Earth Day in 2016, joined by 175 countries in a single day."
      ]
    },
    "6-21": {
      id: "midsummer", family: "midsummer", name: "Summer Solstice", icon: "☀️",
      kicker: "Solstice Sun", tagline: "The longest sunlit horizon of the year.",
      accent: "245, 158, 11", secondary: "251, 146, 60", tertiary: "253, 224, 71",
      decorations: ["☀️", "🌻", "🌾", "✨"],
      funFacts: [
        "The word 'solstice' comes from Latin 'solstitium' — literally 'sun standing still' — because the Sun's noon altitude pauses before reversing.",
        "Despite having the longest daylight of the year, Earth is actually nearing aphelion, its farthest orbital distance from the Sun.",
        "Ancient monuments from Stonehenge in England to Chichén Itzá in Mexico align precisely with solstice sunrise and sunset azimuths."
      ]
    },
    "8-9": {
      id: "sg_national_day", family: "national_day", name: "Singapore National Day", icon: "🇸🇬",
      kicker: "Majulah Singapura", tagline: "Crimson, white, and fireworks across the bay.",
      accent: "239, 68, 68", secondary: "255, 255, 255", tertiary: "252, 165, 165",
      decorations: ["🇸🇬", "🎆", "🦁", "✨"],
      funFacts: [
        "Each of the five stars on Singapore's flag stands for democracy, peace, progress, justice, and equality, beside the crescent of a young nation rising.",
        "Red symbolises universal brotherhood and equality, while white represents pervading and everlasting purity and virtue.",
        "The first National Day Parade was held on the Padang in 1966, and Marina Bay flypasts and harbour fireworks remain signature traditions."
      ]
    },
    "10-31": {
      id: "halloween", family: "halloween", name: "Halloween", icon: "🎃",
      kicker: "All Hallows' Eve", tagline: "Amber lanterns, midnight bats, and playful mystery.",
      accent: "249, 115, 22", secondary: "168, 85, 247", tertiary: "245, 158, 11",
      decorations: ["🎃", "🕯️", "🦇", "🌙"],
      funFacts: [
        "Jack-o'-lanterns originally began in Ireland and Scotland carved out of turnips, rutabagas, and beets before immigrants discovered North American pumpkins.",
        "Halloween evolves from the ancient Celtic harvest festival of Samhain, which marked the turning of the year into the darker winter half.",
        "A single little brown bat near dusk can catch up to 1,000 mosquito-sized insects per hour using biological sonar."
      ]
    },
    "12-24": {
      id: "christmas_eve", family: "christmas", name: "Christmas Eve", icon: "🎄",
      kicker: "Silent Night", tagline: "Twinkling fairy lights and wintry anticipation.",
      accent: "220, 38, 38", secondary: "22, 163, 74", tertiary: "250, 204, 21",
      decorations: ["🎄", "🕯️", "❄️", "⭐"],
      funFacts: [
        "'Silent Night' (Stille Nacht) was first performed on Christmas Eve 1818 in Oberndorf, Austria, accompanied only by guitar because the church organ had rusted.",
        "NORAD's Santa Tracker began by accident in 1955 after a department store newspaper misprinted an emergency defense hotline number.",
        "In Iceland, Jólabókaflóð ('Christmas Book Flood') sees families exchange books on Christmas Eve and spend the night reading with hot chocolate."
      ]
    },
    "12-25": {
      id: "christmas", family: "christmas", name: "Christmas Day", icon: "🎄",
      kicker: "Winter Solstice", tagline: "Warm hearths, snowfall, and peaceful holiday joy.",
      accent: "220, 38, 38", secondary: "22, 163, 74", tertiary: "250, 204, 21",
      decorations: ["🎄", "❄️", "🎁", "✨"],
      funFacts: [
        "Every winter snowflake forms a unique six-sided crystal symmetry shaped by the exact humidity and temperature cloud layers it tumbles through.",
        "The 1965 NASA Gemini 6 crew played 'Jingle Bells' on a smuggled mini harmonica and sleigh bells — making it the first song ever broadcast from space.",
        "Evergreen pine boughs became winter festival decorations millennia ago as a vivid promise that spring greenery would return."
      ]
    },
    "12-26": {
      id: "boxing_day", family: "christmas", name: "Boxing Day", icon: "🎁",
      kicker: "Fireside Rest", tagline: "Cosy blankets, warm cocoa, and quiet strolling.",
      accent: "220, 38, 38", secondary: "250, 204, 21", tertiary: "52, 211, 153",
      decorations: ["🎁", "🧣", "❄️", "☕"],
      funFacts: [
        "The name 'Boxing Day' comes from 19th-century Britain, when alms boxes opened in churches and gift boxes were given to tradespeople and staff on December 26.",
        "In Ireland, December 26 is St. Stephen's Day (Wren Day), celebrated with traditional music processions.",
        "Boxing Day cricket Test matches at the Melbourne Cricket Ground date all the way back to 1950."
      ]
    },
    "12-31": {
      id: "new_years_eve", family: "new_year", name: "New Year's Eve", icon: "🥂",
      kicker: "Midnight Countdown", tagline: "Toasts at midnight and sparks over the harbour.",
      accent: "250, 204, 21", secondary: "167, 139, 250", tertiary: "56, 189, 248",
      decorations: ["🥂", "🎆", "🕰️", "✨"],
      funFacts: [
        "Times Square's illuminated New Year's Eve Ball first dropped in 1907 made of iron, wood, and 100 incandescent light bulbs.",
        "Scottish poet Robert Burns transcribed 'Auld Lang Syne' in 1788 — an old Scots phrase roughly meaning 'for the sake of old times.'",
        "In Denmark, leaping off a chair just as midnight strikes symbolises literally jumping smoothly into the new year."
      ]
    }
  },

  MOVABLE_HOLIDAYS: [
    // Lunar New Year
    ...[
      [2025, 1, 28, 1, 30], [2026, 2, 16, 2, 18], [2027, 2, 5, 2, 7],
      [2028, 1, 26, 1, 28], [2029, 2, 13, 2, 15]
    ].map(([y, sm, sd, em, ed]) => [y, sm, sd, em, ed, {
      id: "cny", family: "lantern", name: "Lunar New Year", icon: "🏮",
      kicker: "Spring Festival", tagline: "Crimson silk lanterns, reunion feasts, and warm fortune.",
      accent: "239, 68, 68", secondary: "250, 204, 21", tertiary: "251, 146, 60",
      decorations: ["🏮", "🧧", "🍊", "✨"],
      funFacts: [
        "Because the lunisolar calendar tracks both Moon phases and solar seasons, Lunar New Year always falls on the second New Moon after the Winter Solstice.",
        "Mandarin oranges (橘) are exchanged in pairs because their Cantonese pronunciation sounds like 'gold' and 'good luck.'",
        "Reunion dinner dishes tell wishes aloud — whole fish (余) for abundance year after year and long noodles for longevity."
      ]
    }]),
    // Easter Weekend
    ...[
      [2025, 4, 18, 4, 21], [2026, 4, 3, 4, 6], [2027, 3, 26, 3, 29],
      [2028, 4, 14, 4, 17], [2029, 3, 30, 4, 2]
    ].map(([y, sm, sd, em, ed]) => [y, sm, sd, em, ed, {
      id: "easter", family: "easter", name: "Easter", icon: "🌸",
      kicker: "Spring Bloom", tagline: "Pastel spring blossoms and gentle renewal.",
      accent: "244, 114, 182", secondary: "52, 211, 153", tertiary: "196, 181, 253",
      decorations: ["🌸", "🐣", "🌷", "✨"],
      funFacts: [
        "Easter falls on the first Sunday after the first full Moon following the March vernal equinox, so its date moves between March 22 and April 25.",
        "Intricately hand-painted Easter eggs (pysanky) have been crafted in Eastern Europe for over a millennium as symbols of spring renewal.",
        "The spring tradition of chocolate eggs began in 19th-century France and Germany before becoming a global craft."
      ]
    }]),
    // Mid-Autumn Festival
    ...[
      [2025, 10, 6, 10, 6], [2026, 9, 25, 9, 25], [2027, 9, 15, 9, 15],
      [2028, 10, 3, 10, 3], [2029, 9, 22, 9, 22]
    ].map(([y, sm, sd, em, ed]) => [y, sm, sd, em, ed, {
      id: "mid_autumn", family: "mid_autumn", name: "Mid-Autumn Festival", icon: "🌕",
      kicker: "Harvest Moon", tagline: "Luminous harvest moon, glowing lanterns, and mooncakes.",
      accent: "245, 158, 11", secondary: "253, 224, 71", tertiary: "251, 146, 60",
      decorations: ["🌕", "🏮", "🥮", "🐇"],
      funFacts: [
        "Celebrated on the 15th day of the 8th lunar month, Mid-Autumn night coincides with one of the brightest, fullest moons of the autumn sky.",
        "Because the Moon's surface dark basalt plains look like a rabbit pounding herbs with a mortar, folklore pairs the Jade Rabbit with mooncakes.",
        "China's Chang'e lunar exploration programme takes its name directly from the Moon goddess celebrated on Mid-Autumn night."
      ]
    }]),
    // Diwali / Festival of Lights
    ...[
      [2025, 10, 20, 10, 20], [2026, 11, 8, 11, 8], [2027, 10, 29, 10, 29],
      [2028, 10, 17, 10, 17], [2029, 11, 5, 11, 5]
    ].map(([y, sm, sd, em, ed]) => [y, sm, sd, em, ed, {
      id: "diwali", family: "diwali", name: "Diwali", icon: "🪔",
      kicker: "Festival of Lights", tagline: "Golden earthen lamps and radiant courtyard light.",
      accent: "245, 158, 11", secondary: "236, 72, 153", tertiary: "253, 224, 71",
      decorations: ["🪔", "✨", "🪷", "🎇"],
      funFacts: [
        "The word 'Diwali' comes from Sanskrit 'Deepavali', meaning 'rows of lighted lamps' — signifying light overcoming darkness.",
        "Colourful courtyard rangoli mandalas made from dyed rice flour or flower petals welcome guests and share food with tiny birds and insects.",
        "In 2024, over 2.5 million clay oil diyas were lit simultaneously along the Sarayu riverfront in Ayodhya."
      ]
    }]),
    // Thanksgiving
    ...[
      [2025, 11, 27, 11, 27], [2026, 11, 26, 11, 26], [2027, 11, 25, 11, 25],
      [2028, 11, 23, 11, 23], [2029, 11, 22, 11, 22]
    ].map(([y, sm, sd, em, ed]) => [y, sm, sd, em, ed, {
      id: "thanksgiving", family: "thanksgiving", name: "Thanksgiving", icon: "🍁",
      kicker: "Autumn Harvest", tagline: "Amber maple leaves, harvest warmth, and gratitude.",
      accent: "234, 88, 12", secondary: "217, 119, 6", tertiary: "245, 158, 11",
      decorations: ["🍁", "🍂", "🕯️", "🌾"],
      funFacts: [
        "President Abraham Lincoln proclaimed Thanksgiving a national annual holiday in 1863 after magazine editor Sarah Josepha Hale campaigned for 17 years.",
        "Cranberries earn the nickname 'bounceberries' because farmers test ripeness by whether fresh berries bounce briskly off wooden sorting boards.",
        "Maple trees turn fiery amber and crimson in autumn as cool nights reveal carotenoid and anthocyanin pigments hidden beneath summer chlorophyll."
      ]
    }])
  ],

  _previewHolidayId: null,
  _serverHoliday: null,
  _particles: [],
  _particleSig: "",
  _fireworks: [],
  _fwTimer: 0,
  _bats: [],
  _sleigh: null,
  _sleighTimer: 5,
  _surfaceBursts: [],
  _surfaceBurstTimer: 0.6,
  _factIndexByHoliday: {},
  _factDismissTimer: null,
  _celebrationCanvas: null,
  _celebrationRaf: null,
  _celebrationState: null,

  _escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  _lookupById(hid) {
    if (!hid) return null;
    for (const k of Object.keys(this.MAJOR_HOLIDAYS)) {
      if (this.MAJOR_HOLIDAYS[k].id === hid) return { ...this.MAJOR_HOLIDAYS[k] };
    }
    for (let i = 0; i < this.MOVABLE_HOLIDAYS.length; i++) {
      const entry = this.MOVABLE_HOLIDAYS[i][5];
      if (entry.id === hid) return { ...entry };
    }
    return {
      id: hid, family: "generic", name: hid.replace(/_/g, " "), icon: "🎉",
      kicker: "Celebration", tagline: "Wishing you a joyful holiday.",
      accent: "245, 158, 11", secondary: "56, 189, 248", tertiary: "250, 204, 21",
      decorations: ["✨", "🎉", "🌟", "🎈"],
      funFacts: [
        "Seasonal festivals across cultures grew out of solstices, harvests, and lunar cycles to bring communities together across the turning year."
      ]
    };
  },

  setPreviewHoliday(idOrNull) {
    this._previewHolidayId = idOrNull ? String(idOrNull).trim() : null;
    this._particles = [];
    this._particleSig = "";
    this._fireworks = [];
    this._bats = [];
    this._sleigh = null;
    this._surfaceBursts = [];
    const active = this.getActiveHoliday();
    if (!active) {
      this.dismissHolidayFactPopup();
      this.clearCelebrationCanvas();
    }
    this.applyHolidayUITheme(active);
    if (typeof Dashboard !== "undefined" && Dashboard.renderHolidayDecorations) {
      try { Dashboard.renderHolidayDecorations(active); } catch (_) {}
    }
    if (typeof WaveCanvas !== "undefined" && WaveCanvas.ctx) {
      try { WaveCanvas.draw(0.016); } catch (_) {}
    }
  },

  setServerHoliday(info) {
    if (!info || !info.id) {
      this._serverHoliday = null;
      this.applyHolidayUITheme(this.getActiveHoliday());
      return;
    }
    const base = this._lookupById(info.id) || {};
    this._serverHoliday = {
      ...base,
      id: info.id,
      name: info.name || base.name || "Holiday",
      icon: info.icon || base.icon || "🎉"
    };
    this.applyHolidayUITheme(this.getActiveHoliday());
  },

  getHolidayForDate(dateObj = null) {
    const dt = dateObj instanceof Date ? dateObj : new Date();
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    const fixed = this.MAJOR_HOLIDAYS[`${m}-${d}`];
    if (fixed) return { ...fixed };

    const curVal = y * 10000 + m * 100 + d;
    for (let i = 0; i < this.MOVABLE_HOLIDAYS.length; i++) {
      const [hy, sm, sd, em, ed, info] = this.MOVABLE_HOLIDAYS[i];
      if (hy !== y) continue;
      const startVal = hy * 10000 + sm * 100 + sd;
      const endVal = hy * 10000 + em * 100 + ed;
      if (curVal >= startVal && curVal <= endVal) return { ...info };
    }
    return null;
  },

  getActiveHoliday() {
    if (this._previewHolidayId) return this._lookupById(this._previewHolidayId);
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("holiday");
      if (q) return this._lookupById(q.trim());
    } catch (_) {}
    const localHol = this.getHolidayForDate(new Date());
    if (localHol) return localHol;
    if (this._serverHoliday) return { ...this._serverHoliday };
    return null;
  },

  applyHolidayUITheme(hol) {
    const root = document.documentElement;
    if (!root) return;
    if (!hol || !hol.id) {
      root.removeAttribute("data-holiday");
      root.removeAttribute("data-holiday-family");
      root.style.removeProperty("--holiday-accent");
      root.style.removeProperty("--holiday-secondary");
      root.style.removeProperty("--holiday-tertiary");
      return;
    }
    const base = this._lookupById(hol.id) || {};
    const merged = { ...base, ...hol };
    root.setAttribute("data-holiday", merged.id || "generic");
    root.setAttribute("data-holiday-family", merged.family || "generic");
    if (merged.accent) root.style.setProperty("--holiday-accent", merged.accent);
    if (merged.secondary) root.style.setProperty("--holiday-secondary", merged.secondary);
    if (merged.tertiary) root.style.setProperty("--holiday-tertiary", merged.tertiary);
  },

  _getFamilyFlourishSvg(family) {
    switch (family) {
      case "thanksgiving":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v14M9 5l3.5-2-1 3.8 3.8.5-2.8 2.8 1.5 2.4-5-1.2-5 1.2 1.5-2.4L2.7 7.3l3.8-.5-1-3.8L9 5z"/></svg>';
      case "christmas":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5v15M2.5 5.2l13 7.6M15.5 5.2l-13 7.6"/><circle cx="9" cy="9" r="1.8" fill="currentColor"/></svg>';
      case "lantern":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="4.5" width="9" height="9" rx="4.2"/><path d="M9 2v2.5M9 13.5V16M6.2 15.5v-1.8M11.8 15.5v-1.8M6.5 9h5"/></svg>';
      case "halloween":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 3.5a6.2 6.2 0 1 0 2 10.6 5.2 5.2 0 0 1-2-10.6z"/><path d="M11 8l2-1.8L15 8l-1.8 1.4z"/></svg>';
      case "diwali":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.2c1.6 2 1.8 3.7 0 5-1.8-1.3-1.6-3 0-5z"/><path d="M3 10.5c1.8 3.2 4 4.3 6 4.3s4.2-1.1 6-4.3H3z"/></svg>';
      case "mid_autumn":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="4.8"/><path d="M2.5 13.8c2-.9 3.6-.9 5.5 0s3.8.9 7.5 0"/></svg>';
      case "valentines":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14.8S3 10.8 3 6.6A3.2 3.2 0 0 1 9 4.7a3.2 3.2 0 0 1 6 1.9c0 4.2-6 8.2-6 8.2z"/></svg>';
      case "st_patricks":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5.2" r="2.6"/><circle cx="5.8" cy="10" r="2.6"/><circle cx="12.2" cy="10" r="2.6"/><path d="M9 11.5c0 2.4-1 3.8-2.2 4.6"/></svg>';
      case "easter":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><circle cx="9" cy="9" r="2"/><path d="M9 3c1.6 0 2.2 1.6 1 3M14.7 7.2c.5 1.5-.8 2.6-2.4 1.9M12.5 13.8c-1.3.9-2.7 0-2.5-1.7M5.5 13.8c-1.3-.9-1.2-2.6.4-2.8M3.3 7.2c.5-1.5 2.2-1.8 3-.4"/></svg>';
      case "earth_day":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"><circle cx="9" cy="9" r="6"/><path d="M9 13V7M9 10c2.2 0 3.2-1.4 3.2-3.2-1.8 0-3.2 1-3.2 3.2z"/></svg>';
      case "midsummer":
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="9" cy="9" r="3.4"/><path d="M9 1.8v2M9 14.2v2M1.8 9h2M14.2 9h2M3.9 3.9l1.4 1.4M12.7 12.7l1.4 1.4M14.1 3.9l-1.4 1.4M5.3 12.7l-1.4 1.4"/></svg>';
      default:
        return '<svg viewBox="0 0 18 18" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5L10.8 7.2 16.5 9l-5.7 1.8L9 16.5l-1.8-5.7L1.5 9l5.7-1.8z"/></svg>';
    }
  },

  getBadgeMarkup(holiday) {
    if (!holiday || !holiday.name) return "";
    const base = this._lookupById(holiday.id) || {};
    const merged = { ...base, ...holiday };
    const flourish = this._getFamilyFlourishSvg(merged.family || "generic");
    const kicker = this._escapeHtml(merged.kicker || "Celebration");
    const title = this._escapeHtml(merged.name || "Holiday");
    const icon = this._escapeHtml(merged.icon || "✨");

    return [
      `<span class="holiday-badge-ornament holiday-badge-ornament--left" aria-hidden="true">${flourish}</span>`,
      `<span class="holiday-badge-emblem" aria-hidden="true">${icon}</span>`,
      `<span class="holiday-badge-copy">`,
      `<span class="holiday-badge-kicker">${kicker}</span>`,
      `<span class="holiday-badge-title">${title}</span>`,
      `</span>`,
      `<span class="holiday-badge-ornament holiday-badge-ornament--right" aria-hidden="true">${flourish}</span>`
    ].join("");
  },

  _ensureParticles(hol, w, h, dt) {
    const isNarrow = w < 720;
    const sig = `${hol.id}:${isNarrow ? "m" : "d"}`;
    const targetCount = isNarrow ? 18 : 34;
    if (this._particleSig !== sig || this._particles.length === 0) {
      this._particleSig = sig;
      this._particles = [];
      for (let i = 0; i < targetCount; i++) {
        this._particles.push(this._makeParticle(hol, w, h, true));
      }
    }
    const fam = hol.family;
    const rises = fam === "lantern" || fam === "diwali" || fam === "mid_autumn" || fam === "earth_day" || fam === "midsummer";
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      p.phase += dt * 1.65;
      p.rot += p.rotSpd * dt;
      if (rises) {
        p.y -= p.vy * dt;
        p.x += Math.sin(p.phase) * p.sway * dt + p.vx * dt;
        if (p.y < -30) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }
      } else {
        p.y += p.vy * dt;
        p.x += Math.sin(p.phase) * p.sway * dt + p.vx * dt;
        if (p.y > h + 25) {
          p.y = -20;
          p.x = Math.random() * w;
        }
      }
      if (p.x < -30) p.x = w + 25;
      if (p.x > w + 30) p.x = -25;
    }
  },

  _makeParticle(hol, w, h, randomY) {
    const fam = hol.family;
    const isRise = fam === "lantern" || fam === "diwali" || fam === "mid_autumn" || fam === "earth_day" || fam === "midsummer";
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : (isRise ? h + 15 : -15),
      vx: (fam === "thanksgiving" ? -12 : 0) + (Math.random() - 0.5) * 16,
      vy: (fam === "christmas" ? 22 : (isRise ? 16 : 24)) + Math.random() * 18,
      sway: 10 + Math.random() * 18,
      size: (fam === "thanksgiving" ? 4.8 : 2.4) + Math.random() * 4.2,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 2.1,
      variant: Math.floor(Math.random() * 4),
      alpha: 0.48 + Math.random() * 0.44
    };
  },

  _drawSeasonalAtmosphere(ctx, w, h, hol, isDark) {
    const fam = hol.family;
    ctx.save();
    let topRgb = null;
    let botRgb = null;
    let topA = 0.08;
    let botA = 0.12;

    if (fam === "thanksgiving") {
      topRgb = "234, 88, 12";
      botRgb = "245, 158, 11";
      topA = isDark ? 0.12 : 0.07;
      botA = isDark ? 0.18 : 0.09;
    } else if (fam === "lantern" || fam === "mid_autumn") {
      topRgb = fam === "lantern" ? "220, 38, 38" : "245, 158, 11";
      botRgb = "250, 204, 21";
      topA = isDark ? 0.11 : 0.05;
      botA = isDark ? 0.14 : 0.06;
    } else if (fam === "halloween") {
      topRgb = "147, 51, 234";
      botRgb = "249, 115, 22";
      topA = isDark ? 0.15 : 0.06;
      botA = isDark ? 0.16 : 0.07;
    } else if (fam === "diwali") {
      topRgb = "236, 72, 153";
      botRgb = "251, 191, 36";
      topA = isDark ? 0.11 : 0.05;
      botA = isDark ? 0.18 : 0.08;
    } else if (fam === "christmas") {
      topRgb = "186, 230, 253";
      botRgb = "52, 211, 153";
      topA = isDark ? 0.10 : 0.05;
      botA = isDark ? 0.08 : 0.04;
    }

    if (topRgb) {
      const tg = ctx.createLinearGradient(0, 0, 0, h * 0.24);
      tg.addColorStop(0, `rgba(${topRgb}, ${topA})`);
      tg.addColorStop(1, `rgba(${topRgb}, 0)`);
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, w, h * 0.24);
    }
    if (botRgb) {
      const bg = ctx.createLinearGradient(0, h * 0.78, 0, h);
      bg.addColorStop(0, `rgba(${botRgb}, 0)`);
      bg.addColorStop(1, `rgba(${botRgb}, ${botA})`);
      ctx.fillStyle = bg;
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
    }
    ctx.restore();
  },

  _drawMapleLeaf(ctx, sz, rgb, alpha, tiltCos) {
    ctx.save();
    ctx.scale(Math.max(0.28, Math.abs(tiltCos)), 1);
    ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(0, -sz * 1.15);
    ctx.lineTo(sz * 0.36, -sz * 0.45);
    ctx.lineTo(sz * 1.08, -sz * 0.62);
    ctx.lineTo(sz * 0.58, -sz * 0.05);
    ctx.lineTo(sz * 0.92, sz * 0.48);
    ctx.lineTo(sz * 0.18, sz * 0.35);
    ctx.lineTo(0, sz * 0.95);
    ctx.lineTo(-sz * 0.18, sz * 0.35);
    ctx.lineTo(-sz * 0.92, sz * 0.48);
    ctx.lineTo(-sz * 0.58, -sz * 0.05);
    ctx.lineTo(-sz * 1.08, -sz * 0.62);
    ctx.lineTo(-sz * 0.36, -sz * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 245, 220, ${(alpha * 0.42).toFixed(3)})`;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.8);
    ctx.lineTo(0, sz * 1.1);
    ctx.stroke();
    ctx.restore();
  },

  _updateFireworks(ctx, w, h, hol, dt, waterLineY = null) {
    const isNarrow = w < 720;
    this._fwTimer -= dt;
    if (this._fwTimer <= 0 && this._fireworks.length < (isNarrow ? 2 : 4)) {
      this._fwTimer = isNarrow ? 2.4 + Math.random() * 1.9 : 1.35 + Math.random() * 1.5;
      const fx = w * (0.12 + Math.random() * 0.76);
      const fy = h * (0.08 + Math.random() * 0.18);
      const isSg = hol.id === "sg_national_day";
      const isCny = hol.family === "lantern";
      const isDiwali = hol.family === "diwali";
      const palette = isSg
        ? ["239, 68, 68", "255, 255, 255", "252, 165, 165"]
        : isCny
          ? ["239, 68, 68", "250, 204, 21", "251, 146, 60"]
          : isDiwali
            ? ["251, 191, 36", "236, 72, 153", "253, 224, 71"]
            : ["250, 204, 21", "56, 189, 248", "244, 114, 182", "167, 243, 208"];
      const rgb = palette[Math.floor(Math.random() * palette.length)];
      const rgbInner = palette[(Math.floor(Math.random() * palette.length) + 1) % palette.length];
      const sparks = [];
      const count = isNarrow ? 16 : 26;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
        const spd = 34 + Math.random() * 48;
        sparks.push({ ang, spd, size: 1.4 + Math.random() * 1.5, ring: i % 2 === 0 ? 1.0 : 0.58 });
      }
      this._fireworks.push({ x: fx, y: fy, startY: waterLineY ? waterLineY - 4 : fy + 80, age: 0, maxAge: 1.7, rgb, rgbInner, sparks });
    }

    const alive = [];
    for (let i = 0; i < this._fireworks.length; i++) {
      const fw = this._fireworks[i];
      fw.age += dt;
      if (fw.age >= fw.maxAge) continue;
      alive.push(fw);
      const rawT = fw.age / fw.maxAge;
      // Quick ascent trail over first 14%, then chrysanthemum bloom
      if (rawT < 0.14) {
        const u = rawT / 0.14;
        const cy = fw.startY + (fw.y - fw.startY) * (1 - Math.pow(1 - u, 2));
        const py = fw.startY + (fw.y - fw.startY) * (1 - Math.pow(1 - Math.max(0, u - 0.35), 2));
        ctx.strokeStyle = `rgba(${fw.rgb}, ${(0.78 * u).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(fw.x, py);
        ctx.lineTo(fw.x, cy);
        ctx.stroke();
        continue;
      }

      const t = (rawT - 0.14) / 0.86;
      const env = t < 0.16 ? (t / 0.16) : Math.pow(1 - (t - 0.16) / 0.84, 1.35);
      const radiusScale = 1 - Math.pow(1 - t, 2.25);

      const coreR = 20 * (1 - t * 0.55);
      const cg = ctx.createRadialGradient(fw.x, fw.y, 0, fw.x, fw.y, coreR);
      cg.addColorStop(0, `rgba(255, 255, 255, ${(0.50 * env).toFixed(3)})`);
      cg.addColorStop(1, `rgba(${fw.rgb}, 0)`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(fw.x, fw.y, coreR, 0, Math.PI * 2);
      ctx.fill();

      for (let s = 0; s < fw.sparks.length; s++) {
        const sp = fw.sparks[s];
        const col = sp.ring < 0.8 ? fw.rgbInner : fw.rgb;
        const rMul = sp.spd * sp.ring;
        const sx = fw.x + Math.cos(sp.ang) * rMul * radiusScale;
        const sy = fw.y + Math.sin(sp.ang) * rMul * radiusScale + 20 * t * t;
        const px = fw.x + Math.cos(sp.ang) * rMul * Math.max(0, radiusScale - 0.14);
        const py = fw.y + Math.sin(sp.ang) * rMul * Math.max(0, radiusScale - 0.14) + 20 * Math.max(0, t - 0.08) * Math.max(0, t - 0.08);
        ctx.strokeStyle = `rgba(${col}, ${(0.82 * env).toFixed(3)})`;
        ctx.lineWidth = sp.size * 0.85;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.88 * env).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sp.size * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }

      if (waterLineY && waterLineY > fw.y) {
        ctx.fillStyle = `rgba(${fw.rgb}, ${(0.14 * env).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(fw.x, waterLineY + 14, 28 * radiusScale + 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this._fireworks = alive;
  },

  _drawSnowflakesAndParticles(ctx, hol, isDarkMode) {
    const fam = hol.family;
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      const a = p.alpha * (isDarkMode ? 0.90 : 0.78);
      ctx.globalAlpha = a;

      if (fam === "christmas") {
        if (p.variant === 0 && p.size > 3.2) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
          ctx.lineWidth = 0.85;
          ctx.rotate(p.rot);
          for (let b = 0; b < 3; b++) {
            const ang = (b * Math.PI) / 3;
            const dx = Math.cos(ang) * p.size;
            const dy = Math.sin(ang) * p.size;
            ctx.beginPath();
            ctx.moveTo(-dx, -dy);
            ctx.lineTo(dx, dy);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (fam === "lantern" || fam === "mid_autumn") {
        const wL = p.size * 1.45;
        const hL = p.size * 2.05;
        const lg = ctx.createRadialGradient(0, 0, 0.5, 0, 0, hL * 1.4);
        lg.addColorStop(0, `rgba(${hol.secondary}, 0.92)`);
        lg.addColorStop(0.55, `rgba(${hol.accent}, 0.55)`);
        lg.addColorStop(1, `rgba(${hol.accent}, 0)`);
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(0, 0, hL * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${hol.accent}, 0.92)`;
        ctx.beginPath();
        ctx.roundRect(-wL * 0.5, -hL * 0.5, wL, hL, wL * 0.36);
        ctx.fill();
        ctx.fillStyle = `rgba(${hol.secondary}, 0.90)`;
        ctx.fillRect(-wL * 0.36, -hL * 0.52, wL * 0.72, 1.4);
        ctx.fillRect(-wL * 0.36, hL * 0.44, wL * 0.72, 1.4);
        ctx.strokeStyle = `rgba(${hol.secondary}, 0.75)`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, hL * 0.5);
        ctx.lineTo(0, hL * 0.78);
        ctx.stroke();
      } else if (fam === "diwali") {
        const sparkR = p.size * 0.95;
        const col = p.variant % 2 === 0 ? hol.accent : hol.secondary;
        const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, sparkR * 2.1);
        dg.addColorStop(0, "rgba(255, 250, 220, 0.96)");
        dg.addColorStop(0.42, `rgba(${col}, 0.65)`);
        dg.addColorStop(1, `rgba(${col}, 0)`);
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(0, 0, sparkR * 2.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (fam === "valentines") {
        const s = p.size * 0.9;
        ctx.rotate(p.rot * 0.5);
        ctx.fillStyle = p.variant % 2 === 0 ? "rgba(251, 113, 133, 0.78)" : "rgba(244, 114, 182, 0.72)";
        ctx.beginPath();
        ctx.moveTo(0, s * 0.5);
        ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.55, -s * 1.2, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 0.55, -s * 1.2, s * 1.1, -s * 0.35, 0, s * 0.5);
        ctx.fill();
      } else if (fam === "st_patricks") {
        const r = p.size * 0.56;
        ctx.rotate(p.rot * 0.4);
        ctx.fillStyle = p.variant === 3 ? "rgba(250, 204, 21, 0.80)" : "rgba(52, 211, 153, 0.78)";
        if (p.variant === 3) {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else {
          [[0, -r], [-r * 0.9, r * 0.4], [r * 0.9, r * 0.4]].forEach(([cx, cy]) => {
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      } else if (fam === "thanksgiving") {
        ctx.rotate(p.rot);
        const leafPalette = ["220, 62, 24", "234, 88, 12", "217, 119, 6", "245, 158, 11"];
        const col = leafPalette[p.variant % leafPalette.length];
        if (p.variant === 3) {
          // Warm autumn gold mote
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 1.5);
          g.addColorStop(0, "rgba(253, 224, 71, 0.88)");
          g.addColorStop(1, "rgba(245, 158, 11, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          this._drawMapleLeaf(ctx, p.size, col, 0.85, Math.cos(p.phase * 0.8));
        }
      } else if (fam === "easter") {
        ctx.rotate(p.rot * 0.6);
        const col = p.variant === 0 ? "249, 168, 212" : (p.variant === 1 ? "253, 230, 138" : "167, 243, 208");
        ctx.fillStyle = `rgba(${col}, 0.78)`;
        for (let k = 0; k < 5; k++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.beginPath();
          ctx.ellipse(0, p.size * 0.62, p.size * 0.34, p.size * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.rotate(p.phase);
        const col = p.variant % 2 === 0 ? hol.accent : hol.secondary;
        ctx.fillStyle = `rgba(${col}, 0.76)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.1, p.size * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  _drawLightGarland(ctx, x0, y0, x1, y1, sag, count, step, colors, opts = {}) {
    ctx.save();
    ctx.strokeStyle = opts.wireColor || "rgba(30, 41, 59, 0.45)";
    ctx.lineWidth = opts.wireWidth || 1.0;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) * 0.5, (y0 + y1) * 0.5 + sag, x1, y1);
    ctx.stroke();

    const rGlow = opts.glowR || 7.2;
    const isLantern = !!opts.lanterns;
    for (let i = 1; i < count; i++) {
      const f = i / count;
      const inv = 1 - f;
      const bx = inv * inv * x0 + 2 * inv * f * ((x0 + x1) * 0.5) + f * f * x1;
      const by = inv * inv * y0 + 2 * inv * f * ((y0 + y1) * 0.5 + sag) + f * f * y1;
      const col = colors[i % colors.length];
      const twinkle = 0.55 + 0.45 * Math.sin(step * 4.2 + i * 1.1);
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, rGlow);
      rg.addColorStop(0, `rgba(${col}, ${(0.88 * twinkle).toFixed(3)})`);
      rg.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(bx, by, rGlow, 0, Math.PI * 2);
      ctx.fill();
      if (isLantern) {
        const sway = Math.sin(step * 2.1 + i * 0.9) * 1.5;
        ctx.fillStyle = `rgba(${col}, 0.92)`;
        ctx.beginPath();
        ctx.ellipse(bx + sway, by + 3.2, 3.0, 4.0, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(253, 224, 71, 0.95)";
        ctx.fillRect(bx + sway - 1.8, by + 6.8, 3.6, 1.3);
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.86 * twinkle).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  _drawDiyaRow(ctx, spots, step, scale = 1.0) {
    ctx.save();
    for (let i = 0; i < spots.length; i++) {
      const pt = spots[i];
      const flicker = 0.78 + 0.22 * Math.sin(step * 7.5 + i * 2.3);
      const fg = ctx.createRadialGradient(pt.x, pt.y - 3 * scale, 0, pt.x, pt.y - 3 * scale, 11 * scale);
      fg.addColorStop(0, `rgba(254, 240, 138, ${(0.92 * flicker).toFixed(3)})`);
      fg.addColorStop(0.45, `rgba(249, 115, 22, ${(0.46 * flicker).toFixed(3)})`);
      fg.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 3 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.fill();
      // Terracotta cup
      ctx.fillStyle = "#B45309";
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, 4.2 * scale, 2.0 * scale, 0, 0, Math.PI);
      ctx.fill();
      // Flame
      ctx.fillStyle = "rgba(254, 249, 195, 0.96)";
      ctx.beginPath();
      ctx.ellipse(pt.x + Math.sin(step * 8 + i) * 0.5, pt.y - 2.6 * scale, 1.3 * scale, 2.5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  _drawJackOLanterns(ctx, spots, step, scale = 1.0) {
    ctx.save();
    for (let i = 0; i < spots.length; i++) {
      const pt = spots[i];
      const pulse = 0.74 + 0.26 * Math.sin(step * 4.4 + i * 1.7);
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 13 * scale);
      g.addColorStop(0, `rgba(251, 146, 60, ${(0.88 * pulse).toFixed(3)})`);
      g.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 13 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#EA580C";
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, 4.8 * scale, 3.8 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      // Carved eyes + grin
      ctx.fillStyle = `rgba(254, 240, 138, ${(0.95 * pulse).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x - 1.6 * scale, pt.y - 0.8 * scale, 0.8 * scale, 0, Math.PI * 2);
      ctx.arc(pt.x + 1.6 * scale, pt.y - 0.8 * scale, 0.8 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(pt.x - 1.7 * scale, pt.y + 0.9 * scale, 3.4 * scale, 0.9 * scale);
    }
    ctx.restore();
  },

  _drawMoonAndBats(ctx, w, h, hol, dt, step, moonX, moonY, moonR, opts = {}) {
    const isHalo = hol.family === "halloween";
    const alphaScale = opts.alpha !== undefined ? opts.alpha : 1.0;
    const mGrad = ctx.createRadialGradient(moonX, moonY, moonR * 0.15, moonX, moonY, moonR * 2.25);
    mGrad.addColorStop(0, isHalo ? `rgba(255, 237, 213, ${(0.88 * alphaScale).toFixed(3)})` : `rgba(254, 249, 195, ${(0.90 * alphaScale).toFixed(3)})`);
    mGrad.addColorStop(0.46, isHalo ? `rgba(251, 146, 60, ${(0.74 * alphaScale).toFixed(3)})` : `rgba(253, 224, 71, ${(0.70 * alphaScale).toFixed(3)})`);
    mGrad.addColorStop(0.58, isHalo ? `rgba(249, 115, 22, ${(0.28 * alphaScale).toFixed(3)})` : `rgba(253, 224, 71, ${(0.22 * alphaScale).toFixed(3)})`);
    mGrad.addColorStop(1, "rgba(251, 146, 60, 0)");
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 2.25, 0, Math.PI * 2);
    ctx.fill();

    if (isHalo) {
      if (this._bats.length === 0) {
        const count = w < 720 ? 4 : 7;
        for (let i = 0; i < count; i++) {
          this._bats.push({
            x: moonX + (Math.random() - 0.5) * 260,
            y: moonY + (Math.random() - 0.5) * 80,
            vx: (i % 2 === 0 ? 1 : -1) * (28 + Math.random() * 24),
            phase: i * 1.4
          });
        }
      }
      ctx.strokeStyle = "rgba(15, 23, 42, 0.78)";
      ctx.lineWidth = 1.65;
      this._bats.forEach((b, idx) => {
        b.phase += dt * 9;
        b.x += b.vx * dt;
        b.y += Math.sin(b.phase * 0.4 + idx) * 14 * dt;
        if (b.vx > 0 && b.x > w + 40) b.x = -40;
        if (b.vx < 0 && b.x < -40) b.x = w + 40;
        const flap = Math.sin(b.phase) * 4.5;
        ctx.beginPath();
        ctx.moveTo(b.x - 8, b.y + flap);
        ctx.quadraticCurveTo(b.x - 3, b.y - 4, b.x, b.y);
        ctx.quadraticCurveTo(b.x + 3, b.y - 4, b.x + 8, b.y + flap);
        ctx.stroke();
      });
    }
  },

  _drawSantaSleighSilhouette(ctx, w, h, dt, step) {
    if (!this._sleigh) {
      this._sleighTimer -= dt;
      if (this._sleighTimer <= 0) {
        this._sleigh = { x: -130, y: h * 0.14, speed: w < 720 ? 64 : 88 };
      }
      return;
    }
    const sl = this._sleigh;
    sl.x += sl.speed * dt;
    const sy = sl.y + Math.sin(step * 1.8) * 6;
    ctx.save();
    ctx.translate(sl.x, sy);
    ctx.globalAlpha = 0.62;
    // Stardust trail behind sleigh runners
    for (let s = 1; s <= 5; s++) {
      ctx.fillStyle = `rgba(253, 224, 71, ${(0.55 - s * 0.09).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(-28 - s * 10, 3 + Math.sin(step * 5 + s) * 2.5, 1.8 - s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(30, 41, 59, 0.88)";
    ctx.beginPath();
    ctx.roundRect(-24, -4, 16, 7, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(250, 204, 21, 0.72)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-26, 4);
    ctx.quadraticCurveTo(-15, 6, -6, 2);
    ctx.stroke();
    [6, 18, 30].forEach((rx, rIdx) => {
      const bob = Math.sin(step * 6 + rIdx * 0.8) * 1.6;
      ctx.fillStyle = "rgba(30, 41, 59, 0.88)";
      ctx.beginPath();
      ctx.ellipse(rx, -1 + bob, 4.2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (rIdx === 2) {
        ctx.fillStyle = "rgba(248, 113, 113, 0.96)";
        ctx.beginPath();
        ctx.arc(rx + 4.8, -2 + bob, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
    if (sl.x > w + 150) {
      this._sleigh = null;
      this._sleighTimer = 26 + Math.random() * 18;
    }
  },

  _drawUnderwaterSurfaceFireworks(ctx, w, h, hol, pal, dt, step) {
    const isNarrow = w < 720;
    this._surfaceBurstTimer -= dt;
    if (this._surfaceBurstTimer <= 0 && this._surfaceBursts.length < 4) {
      this._surfaceBurstTimer = isNarrow ? 1.45 : 0.92 + Math.random() * 0.45;
      const isSg = hol.id === "sg_national_day";
      const colors = isSg
        ? ["239, 68, 68", "255, 255, 255", "252, 165, 165"]
        : ["250, 204, 21", "56, 189, 248", "244, 114, 182", "52, 211, 153"];
      this._surfaceBursts.push({
        x: w * (0.16 + Math.random() * 0.68),
        rgb: colors[Math.floor(Math.random() * colors.length)],
        rgb2: colors[(Math.floor(Math.random() * colors.length) + 1) % colors.length],
        age: 0,
        maxAge: 2.35,
        slant: (Math.random() - 0.5) * 0.24
      });
    }

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const alive = [];
    for (let i = 0; i < this._surfaceBursts.length; i++) {
      const b = this._surfaceBursts[i];
      b.age += dt;
      if (b.age >= b.maxAge) continue;
      alive.push(b);
      const t = b.age / b.maxAge;
      const env = t < 0.18 ? (t / 0.18) : Math.pow(1 - (t - 0.18) / 0.82, 1.15);
      const spread = 78 + t * 145;

      // Vivid chromatic bloom refracting along ocean surface ceiling
      const sg = ctx.createRadialGradient(b.x, 8, 2, b.x, 14, spread);
      sg.addColorStop(0, `rgba(255, 255, 255, ${(0.55 * env).toFixed(3)})`);
      sg.addColorStop(0.28, `rgba(${b.rgb}, ${(0.52 * env).toFixed(3)})`);
      sg.addColorStop(0.65, `rgba(${b.rgb2}, ${(0.22 * env).toFixed(3)})`);
      sg.addColorStop(1, `rgba(${b.rgb}, 0)`);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(b.x, 12, spread, 42, 0, 0, Math.PI * 2);
      ctx.fill();

      // Refracted chromatic light shafts + cascading shimmer sparks
      const depth = h * 0.48;
      const lg = ctx.createLinearGradient(b.x, 0, b.x + depth * b.slant, depth);
      lg.addColorStop(0, `rgba(${b.rgb}, ${(0.28 * env).toFixed(3)})`);
      lg.addColorStop(0.55, `rgba(${b.rgb2}, ${(0.12 * env).toFixed(3)})`);
      lg.addColorStop(1, `rgba(${b.rgb}, 0)`);
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(b.x - 28, 0);
      ctx.lineTo(b.x + 28, 0);
      ctx.lineTo(b.x + depth * b.slant + 78, depth);
      ctx.lineTo(b.x + depth * b.slant - 78, depth);
      ctx.closePath();
      ctx.fill();

      for (let s = 0; s < 5; s++) {
        const spX = b.x + Math.sin(s * 2.1 + i * 1.7) * (32 + t * 48);
        const spY = 14 + t * 56 + (s % 3) * 14;
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.72 * env).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(spX, spY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this._surfaceBursts = alive;
    ctx.restore();
  },

  drawNatureOverlay(ctx, w, h, mode, dt, step, holidayOverride = null) {
    const hol = holidayOverride || this.getActiveHoliday();
    if (!hol) return;
    const isDark = mode === "dark" || mode === "evening";
    const fam = hol.family;
    ctx.save();
    this._drawSeasonalAtmosphere(ctx, w, h, hol, isDark);

    if (fam === "thanksgiving") {
      const harvestCols = ["234, 88, 12", "245, 158, 11", "220, 38, 38", "253, 224, 71"];
      this._drawLightGarland(ctx, w * 0.02, 10, w * 0.34, 14, 18, 9, step, harvestCols);
      this._drawLightGarland(ctx, w * 0.66, 14, w * 0.98, 10, 18, 9, step + 1.2, harvestCols);
      this._drawDiyaRow(ctx, [0.12, 0.24, 0.76, 0.88].map(f => ({ x: w * f, y: h - 10 })), step, 0.92);
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    } else if (fam === "christmas") {
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
      this._drawLightGarland(ctx, w * 0.04, 10, w * 0.96, 10, 14, w < 720 ? 10 : 18, step, ["239, 68, 68", "52, 211, 153", "250, 204, 21"]);
      this._drawSantaSleighSilhouette(ctx, w, h, dt, step);
    } else if (fam === "lantern") {
      this._drawLightGarland(ctx, w * 0.04, 8, w * 0.96, 8, 14, w < 720 ? 8 : 14, step, ["239, 68, 68", "250, 204, 21"], { lanterns: true });
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
      this._updateFireworks(ctx, w, h, hol, dt, null);
    } else if (fam === "diwali") {
      const diyaSpots = [0.14, 0.28, 0.50, 0.72, 0.86].map(f => ({ x: w * f, y: h - 10 }));
      this._drawDiyaRow(ctx, diyaSpots, step, w < 720 ? 0.9 : 1.15);
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
      this._updateFireworks(ctx, w, h, hol, dt, null);
    } else if (fam === "new_year" || fam === "national_day") {
      this._updateFireworks(ctx, w, h, hol, dt, null);
    } else if (fam === "halloween" || fam === "mid_autumn") {
      this._drawMoonAndBats(ctx, w, h, hol, dt, step, w * 0.82, h * 0.16, w < 720 ? 22 : 34);
      if (fam === "halloween") {
        this._drawJackOLanterns(ctx, [{ x: w * 0.10, y: h - 14 }, { x: w * 0.88, y: h - 14 }], step, 1.25);
      }
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    } else {
      if (fam === "st_patricks") {
        ctx.save();
        ctx.globalAlpha = isDark ? 0.14 : 0.10;
        const arcR = Math.min(w * 0.36, 340);
        const arcCols = ["#EF4444", "#F59E0B", "#10B981", "#38BDF8", "#8B5CF6"];
        arcCols.forEach((c, idx) => {
          ctx.strokeStyle = c;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(w * 0.78, h * 0.36, arcR - idx * 4.5, Math.PI * 1.08, Math.PI * 1.92);
          ctx.stroke();
        });
        ctx.restore();
      }
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    }
    ctx.restore();
  },

  drawGatewayOverlay(ctx, w, h, L, pal, mode, dt, step, holidayOverride = null) {
    const hol = holidayOverride || this.getActiveHoliday();
    if (!hol || !L) return;
    const isDark = pal ? pal.isNightLights : (mode === "dark" || mode === "evening");
    const fam = hol.family;
    const celMoon = pal && pal.celestial && pal.celestial.moon && pal.celestial.moon.visible ? pal.celestial.moon : null;
    ctx.save();
    this._drawSeasonalAtmosphere(ctx, w, h, hol, isDark);

    if (fam === "thanksgiving") {
      const harvestCols = ["234, 88, 12", "251, 191, 36", "220, 38, 38", "245, 158, 11"];
      this._drawLightGarland(ctx, L.towerLeftX, L.padY - L.towerH * 0.70, L.towerRightX, L.padY - L.towerH * 0.70, 9, 7, step, harvestCols);
      this._drawLightGarland(ctx, L.hangarX - L.hangarW * 0.42, L.hangarY - 5, L.hangarX + L.hangarW * 0.42, L.hangarY - 5, -10, 9, step, harvestCols);
      // Warm amber architectural spire & plaza glow
      const sg = ctx.createRadialGradient(L.termX, L.termY - 60 * L.termScale, 4, L.termX, L.termY - 40 * L.termScale, 82 * L.termScale);
      sg.addColorStop(0, "rgba(251, 191, 36, 0.24)");
      sg.addColorStop(0.55, "rgba(234, 88, 12, 0.10)");
      sg.addColorStop(1, "rgba(234, 88, 12, 0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(L.termX, L.termY - 50 * L.termScale, 82 * L.termScale, 0, Math.PI * 2);
      ctx.fill();
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    } else if (fam === "christmas") {
      const warmCols = ["239, 68, 68", "52, 211, 153", "250, 204, 21", "96, 165, 250"];
      this._drawLightGarland(ctx, L.towerLeftX, L.padY - L.towerH * 0.72, L.towerRightX, L.padY - L.towerH * 0.72, 10, 7, step, warmCols);
      this._drawLightGarland(ctx, L.hangarX - L.hangarW * 0.42, L.hangarY - 6, L.hangarX + L.hangarW * 0.42, L.hangarY - 6, -12, 9, step, warmCols);
      if (L.satWest && L.satEast) {
        this._drawLightGarland(ctx, L.satWest.x + 24 * L.termScale, L.satWest.y - 6, L.termX - 24 * L.termScale, L.termY - 10, 7, 7, step, warmCols);
      }
      // Spire topper golden star
      const sy = L.termY - 114 * L.termScale;
      const sg = ctx.createRadialGradient(L.termX, sy, 0, L.termX, sy, 15);
      sg.addColorStop(0, "rgba(254, 240, 138, 0.96)");
      sg.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(L.termX, sy, 15, 0, Math.PI * 2);
      ctx.fill();
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
      this._drawSantaSleighSilhouette(ctx, w, h, dt, step);
    } else if (fam === "lantern") {
      const cnyCols = ["239, 68, 68", "250, 204, 21", "251, 146, 60"];
      this._drawLightGarland(ctx, L.hangarX - L.hangarW * 0.44, L.hangarY - 6, L.hangarX + L.hangarW * 0.44, L.hangarY - 6, -10, 9, step, cnyCols, { lanterns: true });
      if (L.satWest) {
        this._drawLightGarland(ctx, L.satWest.x + 18 * L.termScale, L.satWest.y - 4, L.termX - 18 * L.termScale, L.termY - 8, 6, 7, step, cnyCols, { lanterns: true });
      }
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
      this._updateFireworks(ctx, w, h, hol, dt, L.islandTopY);
    } else if (fam === "diwali") {
      const diwaliCols = ["251, 191, 36", "236, 72, 153", "253, 224, 71"];
      this._drawLightGarland(ctx, L.towerLeftX, L.padY - L.towerH * 0.72, L.towerRightX, L.padY - L.towerH * 0.72, 10, 7, step, diwaliCols);
      const seawallSpots = [0.22, 0.34, 0.46, 0.58, 0.70].map(f => {
        const px = w * f;
        return { x: px, y: L.shoreYAtX ? L.shoreYAtX(px) - 3 : L.islandBotY - 12 };
      });
      this._drawDiyaRow(ctx, seawallSpots, step, 0.9);
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
      this._updateFireworks(ctx, w, h, hol, dt, L.islandTopY);
    } else if (fam === "new_year" || fam === "national_day") {
      // Celebratory sweeping bay searchlights from terminal & pad
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const beamCol = hol.id === "sg_national_day" ? "254, 202, 202" : "186, 230, 253";
      [L.termX, L.padX].forEach((bx, idx) => {
        const sweep = Math.sin(step * 1.15 + idx * 1.8) * 0.28 + (idx === 0 ? -0.15 : 0.18);
        const byTop = Math.max(0, L.horizonY - h * 0.28);
        const topX = bx + Math.tan(sweep) * (L.termY - byTop);
        const bg = ctx.createLinearGradient(bx, L.termY - 20, topX, byTop);
        bg.addColorStop(0, `rgba(${beamCol}, 0.22)`);
        bg.addColorStop(1, `rgba(${beamCol}, 0)`);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(bx - 4, L.termY - 24);
        ctx.lineTo(bx + 4, L.termY - 24);
        ctx.lineTo(topX + 34, byTop);
        ctx.lineTo(topX - 34, byTop);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
      this._updateFireworks(ctx, w, h, hol, dt, L.islandTopY);
    } else if (fam === "halloween" || fam === "mid_autumn") {
      const mx = celMoon ? celMoon.x : w * 0.84;
      const my = celMoon ? celMoon.y : L.horizonY * 0.56;
      const ma = celMoon ? Math.max(0.55, celMoon.alpha) : 0.45;
      this._drawMoonAndBats(ctx, w, h, hol, dt, step, mx, my, w < 720 ? 20 : 32, { alpha: ma });
      if (fam === "halloween") {
        this._drawJackOLanterns(ctx, [
          { x: L.plazaX ? L.plazaX - 18 : L.termX - 24, y: L.plazaY ? L.plazaY + 4 : L.termY + 28 },
          { x: L.plazaX ? L.plazaX + 20 : L.termX + 28, y: L.plazaY ? L.plazaY + 6 : L.termY + 30 }
        ], step, 0.95);
      }
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    } else {
      if (fam === "st_patricks") {
        ctx.save();
        ctx.globalAlpha = isDark ? 0.14 : 0.11;
        const arcR = Math.min(w * 0.34, 320);
        ["#EF4444", "#F59E0B", "#10B981", "#38BDF8", "#8B5CF6"].forEach((c, idx) => {
          ctx.strokeStyle = c;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(w * 0.72, L.horizonY * 0.92, arcR - idx * 4, Math.PI * 1.10, Math.PI * 1.90);
          ctx.stroke();
        });
        ctx.restore();
      } else if (fam === "earth_day") {
        ctx.save();
        const ag = ctx.createLinearGradient(0, L.horizonY * 0.18, w, L.horizonY * 0.56);
        ag.addColorStop(0, "rgba(16, 185, 129, 0)");
        ag.addColorStop(0.35, "rgba(45, 212, 191, 0.15)");
        ag.addColorStop(0.68, "rgba(56, 189, 248, 0.13)");
        ag.addColorStop(1, "rgba(16, 185, 129, 0)");
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.moveTo(0, L.horizonY * 0.32);
        ctx.quadraticCurveTo(w * 0.35, L.horizonY * 0.14 + Math.sin(step * 0.8) * 14, w, L.horizonY * 0.38);
        ctx.lineTo(w, L.horizonY * 0.58);
        ctx.quadraticCurveTo(w * 0.5, L.horizonY * 0.44, 0, L.horizonY * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (fam === "easter") {
        this._drawLightGarland(ctx, L.hangarX - L.hangarW * 0.40, L.hangarY - 5, L.hangarX + L.hangarW * 0.40, L.hangarY - 5, -9, 8, step, ["249, 168, 212", "167, 243, 208", "253, 230, 138"]);
      } else if (fam === "valentines" || fam === "midsummer") {
        const sg = ctx.createRadialGradient(L.termX, L.termY - 55 * L.termScale, 4, L.termX, L.termY - 40 * L.termScale, 75 * L.termScale);
        sg.addColorStop(0, `rgba(${hol.accent}, 0.22)`);
        sg.addColorStop(1, `rgba(${hol.accent}, 0)`);
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(L.termX, L.termY - 46 * L.termScale, 75 * L.termScale, 0, Math.PI * 2);
        ctx.fill();
      }
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    }
    ctx.restore();
  },

  drawDeepBlueOverlay(ctx, w, h, L, pal, mode, dt, step, holidayOverride = null) {
    const hol = holidayOverride || this.getActiveHoliday();
    if (!hol || !L) return;
    const isDark = pal ? pal.isDark : (mode === "dark" || mode === "evening");
    const fam = hol.family;
    const s = L.s || 1;
    ctx.save();
    this._drawSeasonalAtmosphere(ctx, w, h, hol, isDark);

    if (fam === "thanksgiving") {
      const harvestCols = ["234, 88, 12", "245, 158, 11", "253, 224, 71", "220, 38, 38"];
      this._drawLightGarland(ctx, L.westWingX + 20 * s, L.westWingY + 6 * s, L.hubX - 96 * s, L.hubY + 12 * s, 8 * s, 8, step, harvestCols);
      this._drawLightGarland(ctx, L.hubX + 96 * s, L.hubY + 12 * s, L.eastWingX - 20 * s, L.eastWingY + 6 * s, 8 * s, 8, step, harvestCols);
      // Warm harvest hearth glow inside central habitat dome
      const dg = ctx.createRadialGradient(L.domeX, L.domeY - 4 * s, 2 * s, L.domeX, L.domeY - 4 * s, 32 * s);
      dg.addColorStop(0, "rgba(251, 191, 36, 0.34)");
      dg.addColorStop(0.55, "rgba(234, 88, 12, 0.14)");
      dg.addColorStop(1, "rgba(234, 88, 12, 0)");
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(L.domeX, L.domeY - 4 * s, 32 * s, 0, Math.PI * 2);
      ctx.fill();
      this._ensureParticles({ ...hol, family: "diwali" }, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, { ...hol, family: "diwali" }, isDark);
    } else if (fam === "christmas") {
      const cols = ["239, 68, 68", "52, 211, 153", "250, 204, 21"];
      this._drawLightGarland(ctx, L.westWingX + 20 * s, L.westWingY + 6 * s, L.hubX - 96 * s, L.hubY + 12 * s, 8 * s, 8, step, cols);
      this._drawLightGarland(ctx, L.hubX + 96 * s, L.hubY + 12 * s, L.eastWingX - 20 * s, L.eastWingY + 6 * s, 8 * s, 8, step, cols);
      // Glowing miniature festive pine with ornaments inside hydroponic dome
      ctx.fillStyle = "rgba(34, 197, 94, 0.88)";
      ctx.beginPath();
      ctx.moveTo(L.domeX, L.domeY - 15 * s);
      ctx.lineTo(L.domeX - 10 * s, L.domeY + 4 * s);
      ctx.lineTo(L.domeX + 10 * s, L.domeY + 4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(250, 204, 21, 0.96)";
      ctx.beginPath();
      ctx.arc(L.domeX, L.domeY - 16 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      [[-3, -4], [3, -1], [-4, 1], [2, -8]].forEach(([ox, oy], idx) => {
        ctx.fillStyle = idx % 2 === 0 ? "rgba(248, 113, 113, 0.95)" : "rgba(125, 211, 252, 0.95)";
        ctx.beginPath();
        ctx.arc(L.domeX + ox * s, L.domeY + oy * s, 1.3 * s, 0, Math.PI * 2);
        ctx.fill();
      });
      this._ensureParticles(hol, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, hol, isDark);
    } else if (fam === "lantern" || fam === "diwali") {
      const cols = fam === "lantern" ? ["239, 68, 68", "250, 204, 21"] : ["251, 191, 36", "236, 72, 153", "253, 224, 71"];
      this._drawLightGarland(ctx, L.westWingX + 20 * s, L.westWingY + 6 * s, L.hubX - 96 * s, L.hubY + 12 * s, 8 * s, 7, step, cols, { lanterns: true });
      this._drawLightGarland(ctx, L.hubX + 96 * s, L.hubY + 12 * s, L.eastWingX - 20 * s, L.eastWingY + 6 * s, 8 * s, 7, step, cols, { lanterns: true });
      if (fam === "diwali") {
        this._drawDiyaRow(ctx, [
          { x: L.hubX - 50 * s, y: L.hubY + 14 * s },
          { x: L.hubX + 50 * s, y: L.hubY + 14 * s }
        ], step, s * 0.95);
      }
      this._ensureParticles({ ...hol, family: "diwali" }, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, { ...hol, family: "diwali" }, isDark);
    } else if (fam === "new_year" || fam === "national_day") {
      // Underwater-authentic refracted surface fireworks, glass corridor celebration bulbs & dome skyward beams
      const nyCols = hol.id === "sg_national_day" ? ["239, 68, 68", "255, 255, 255"] : ["250, 204, 21", "56, 189, 248", "244, 114, 182"];
      this._drawLightGarland(ctx, L.westWingX + 20 * s, L.westWingY + 6 * s, L.hubX - 96 * s, L.hubY + 12 * s, 8 * s, 7, step, nyCols);
      this._drawLightGarland(ctx, L.hubX + 96 * s, L.hubY + 12 * s, L.eastWingX - 20 * s, L.eastWingY + 6 * s, 8 * s, 7, step, nyCols);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      [L.westWingX, L.eastWingX].forEach((bx, idx) => {
        const sweep = Math.sin(step * 1.3 + idx * 1.9) * 0.25 + (idx === 0 ? -0.14 : 0.14);
        const topY = 0;
        const topX = bx + Math.tan(sweep) * (L.westWingY - topY);
        const col = nyCols[idx % nyCols.length];
        const bg = ctx.createLinearGradient(bx, L.westWingY - 10 * s, topX, topY);
        bg.addColorStop(0, `rgba(${col}, 0.24)`);
        bg.addColorStop(1, `rgba(${col}, 0)`);
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(bx - 5 * s, L.westWingY - 12 * s);
        ctx.lineTo(bx + 5 * s, L.westWingY - 12 * s);
        ctx.lineTo(topX + 42 * s, topY);
        ctx.lineTo(topX - 42 * s, topY);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
      this._drawUnderwaterSurfaceFireworks(ctx, w, h, hol, pal, dt, step);
      this._ensureParticles({ ...hol, family: "diwali" }, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, { ...hol, family: "diwali" }, isDark);
    } else if (fam === "halloween") {
      const spots = [{ x: L.hubX - 42 * s, y: L.hubY + 10 * s }, ...(L.wreck && !L.isNarrow ? [{ x: L.wreck.x - 16 * L.wreck.scale, y: L.wreck.y - 22 * L.wreck.scale }] : [])];
      this._drawJackOLanterns(ctx, spots, step, s * 0.95);
    } else {
      // Aquatic-authentic bioluminescent marine sparks & dome accent glow (Mid-Autumn buoys, Valentine's, Easter, St. Patrick's, Earth Day, Solstice)
      const cols = [hol.accent, hol.secondary, hol.tertiary || hol.accent];
      if (fam === "mid_autumn" || fam === "easter" || fam === "valentines") {
        this._drawLightGarland(ctx, L.westWingX + 20 * s, L.westWingY + 6 * s, L.hubX - 96 * s, L.hubY + 12 * s, 8 * s, 7, step, cols, { lanterns: fam === "mid_autumn" });
        this._drawLightGarland(ctx, L.hubX + 96 * s, L.hubY + 12 * s, L.eastWingX - 20 * s, L.eastWingY + 6 * s, 8 * s, 7, step, cols, { lanterns: fam === "mid_autumn" });
      }
      const dg = ctx.createRadialGradient(L.domeX, L.domeY - 4 * s, 2 * s, L.domeX, L.domeY - 4 * s, 30 * s);
      dg.addColorStop(0, `rgba(${hol.accent}, 0.28)`);
      dg.addColorStop(1, `rgba(${hol.accent}, 0)`);
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(L.domeX, L.domeY - 4 * s, 30 * s, 0, Math.PI * 2);
      ctx.fill();
      this._ensureParticles({ ...hol, family: "diwali" }, w, h, dt);
      this._drawSnowflakesAndParticles(ctx, { ...hol, family: "diwali" }, isDark);
    }
    ctx.restore();
  },

  getFunFact(holiday) {
    const base = (holiday && holiday.id) ? (this._lookupById(holiday.id) || {}) : {};
    const merged = { ...base, ...(holiday || {}) };
    const facts = Array.isArray(merged.funFacts) && merged.funFacts.length > 0
      ? merged.funFacts
      : ["Seasonal festivals around the world bring warmth, shared stories, and traditions across the calendar."];
    const key = merged.id || merged.name || "generic";
    const idx = (this._factIndexByHoliday[key] || 0) % facts.length;
    this._factIndexByHoliday[key] = (idx + 1) % facts.length;
    return facts[idx];
  },

  dismissHolidayFactPopup() {
    const pop = document.getElementById("holidayFactPopup");
    if (pop) pop.classList.remove("is-visible");
    if (this._factDismissTimer) {
      clearTimeout(this._factDismissTimer);
      this._factDismissTimer = null;
    }
  },

  showHolidayFactPopup(holiday) {
    const hol = holiday || this.getActiveHoliday();
    if (!hol || !hol.name) return;
    const base = hol.id ? (this._lookupById(hol.id) || {}) : {};
    const merged = { ...base, ...hol };
    const fam = merged.family || "generic";
    const factText = this.getFunFact(merged);
    const flourish = this._getFamilyFlourishSvg(fam);

    let pop = document.getElementById("holidayFactPopup");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "holidayFactPopup";
      pop.className = "holiday-fact-popup";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-live", "polite");
      document.body.appendChild(pop);
    }

    if (!this._boundFactEscListener) {
      this._boundFactEscListener = (ev) => {
        if (ev.key === "Escape") this.dismissHolidayFactPopup();
      };
      document.addEventListener("keydown", this._boundFactEscListener);
    }

    pop.dataset.holidayFamily = fam;
    pop.dataset.holidayId = merged.id || "generic";
    pop.style.setProperty("--holiday-accent", merged.accent || "234, 88, 12");
    pop.style.setProperty("--holiday-secondary", merged.secondary || "245, 158, 11");
    pop.innerHTML = [
      `<div class="holiday-fact-popup-inner">`,
      `<div class="holiday-fact-popup-header">`,
      `<div class="holiday-fact-popup-title-wrap">`,
      `<span class="holiday-fact-popup-flourish" aria-hidden="true">${flourish}</span>`,
      `<span class="holiday-fact-popup-emblem" aria-hidden="true">${this._escapeHtml(merged.icon || "✨")}</span>`,
      `<div class="holiday-fact-popup-titles">`,
      `<span class="holiday-fact-popup-kicker">Did You Know? · ${this._escapeHtml(merged.kicker || "Holiday Tradition")}</span>`,
      `<strong class="holiday-fact-popup-name">${this._escapeHtml(merged.name)}</strong>`,
      `</div>`,
      `</div>`,
      `<button type="button" class="holiday-fact-popup-close" aria-label="Close holiday fun fact">&times;</button>`,
      `</div>`,
      `<p class="holiday-fact-popup-body">${this._escapeHtml(factText)}</p>`,
      `<div class="holiday-fact-popup-footer">`,
      `<span class="holiday-fact-popup-tagline">${this._escapeHtml(merged.tagline || "")}</span>`,
      `<button type="button" class="holiday-fact-popup-replay">${this._escapeHtml(merged.icon || "✨")} Replay &amp; Next Fact</button>`,
      `</div>`,
      `</div>`
    ].join("");

    const closeBtn = pop.querySelector(".holiday-fact-popup-close");
    if (closeBtn) closeBtn.onclick = () => this.dismissHolidayFactPopup();
    const replayBtn = pop.querySelector(".holiday-fact-popup-replay");
    if (replayBtn) replayBtn.onclick = () => this.triggerCelebration(merged);

    // Trigger CSS entrance animation reliably
    pop.classList.remove("is-visible");
    void pop.offsetWidth;
    pop.classList.add("is-visible");

    if (this._factDismissTimer) clearTimeout(this._factDismissTimer);
    this._factDismissTimer = setTimeout(() => {
      this.dismissHolidayFactPopup();
    }, 8500);
  },

  clearCelebrationCanvas() {
    if (this._celebrationRaf) {
      try { cancelAnimationFrame(this._celebrationRaf); } catch (_) {}
      this._celebrationRaf = null;
    }
    const canvas = this._celebrationCanvas || document.getElementById("holidayCelebrationCanvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = "none";
    }
    this._celebrationState = null;
  },

  launchFullScreenAnimation(holiday) {
    const hol = holiday || this.getActiveHoliday();
    if (!hol) return;
    const base = hol.id ? (this._lookupById(hol.id) || {}) : {};
    const merged = { ...base, ...hol };
    const fam = merged.family || "generic";

    let canvas = document.getElementById("holidayCelebrationCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "holidayCelebrationCanvas";
      canvas.className = "holiday-celebration-canvas";
      canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
    }
    this._celebrationCanvas = canvas;

    const w = window.innerWidth || 1440;
    const h = window.innerHeight || 900;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.display = "block";
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (this._celebrationRaf) {
      try { cancelAnimationFrame(this._celebrationRaf); } catch (_) {}
      this._celebrationRaf = null;
    }

    const isNarrow = w < 720;
    const palette = [
      merged.accent || "250, 204, 21",
      merged.secondary || "56, 189, 248",
      merged.tertiary || "244, 114, 182"
    ];

    const state = {
      family: fam,
      elapsed: 0.28, // Start partway into bloom so initial frame is visually rich
      duration: 4.6,
      items: [],
      bursts: [],
      bats: []
    };

    if (fam === "new_year" || fam === "national_day" || fam === "diwali") {
      const burstCount = fam === "national_day" ? 7 : 8;
      for (let b = 0; b < burstCount; b++) {
        const bx = w * (0.14 + (b / Math.max(1, burstCount - 1)) * 0.72 + (Math.random() - 0.5) * 0.08);
        const by = h * (0.16 + (b % 3) * 0.14 + Math.random() * 0.08);
        const rgb = fam === "national_day"
          ? (b % 2 === 0 ? "239, 68, 68" : "255, 255, 255")
          : palette[b % palette.length];
        const sparks = [];
        const rays = isNarrow ? 20 : 30;
        for (let r = 0; r < rays; r++) {
          const ang = (r / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
          const spd = (isNarrow ? 115 : 175) * (0.55 + Math.random() * 0.65);
          sparks.push({ ang, spd, size: 1.8 + Math.random() * 2.2 });
        }
        state.bursts.push({ x: bx, y: by, delay: b * 0.44, rgb, sparks });
      }
      for (let i = 0; i < (isNarrow ? 26 : 44); i++) {
        state.items.push({
          x: Math.random() * w,
          y: h * (0.35 + Math.random() * 0.65),
          vx: (Math.random() - 0.5) * 38,
          vy: -(70 + Math.random() * 110),
          size: 3 + Math.random() * 5,
          rot: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          rgb: palette[i % palette.length]
        });
      }
    } else if (fam === "halloween") {
      for (let i = 0; i < (isNarrow ? 14 : 22); i++) {
        const fromLeft = i % 2 === 0;
        state.bats.push({
          x: fromLeft ? (-40 - i * 28) : (w + 40 + i * 28),
          y: h * (0.14 + Math.random() * 0.56),
          vx: (fromLeft ? 1 : -1) * (260 + Math.random() * 180),
          vy: (Math.random() - 0.5) * 55,
          scale: (isNarrow ? 0.75 : 1.05) + Math.random() * 0.55,
          wingPhase: Math.random() * Math.PI * 2
        });
      }
      for (let i = 0; i < (isNarrow ? 34 : 58); i++) {
        state.items.push({
          x: Math.random() * w,
          y: h + Math.random() * h * 0.3,
          vx: (Math.random() - 0.5) * 55,
          vy: -(95 + Math.random() * 120),
          size: 2.5 + Math.random() * 5.5,
          rot: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          rgb: palette[i % palette.length]
        });
      }
    } else if (fam === "lantern" || fam === "mid_autumn") {
      for (let i = 0; i < (isNarrow ? 22 : 36); i++) {
        state.items.push({
          x: w * (0.05 + Math.random() * 0.90),
          y: h * (0.45 + Math.random() * 0.65),
          vx: (Math.random() - 0.5) * 28,
          vy: -(80 + Math.random() * 95),
          size: (isNarrow ? 12 : 16) + Math.random() * 10,
          rot: (Math.random() - 0.5) * 0.14,
          phase: Math.random() * Math.PI * 2,
          rgb: palette[i % palette.length]
        });
      }
    } else {
      // Sweeping full-screen celebratory cascade tailored to Christmas snow/stars, Autumn leaves, Hearts, Clovers, Blossoms, Sunbursts
      const count = isNarrow ? 48 : 82;
      const isRise = fam === "valentines" || fam === "earth_day";
      for (let i = 0; i < count; i++) {
        state.items.push({
          x: Math.random() * w,
          y: isRise ? (h * (0.35 + Math.random() * 0.72)) : (-20 - Math.random() * h * 0.65),
          vx: (fam === "thanksgiving" ? 45 : 0) + (Math.random() - 0.5) * 90,
          vy: isRise ? -(85 + Math.random() * 110) : (105 + Math.random() * 145),
          size: (isNarrow ? 4.5 : 6.2) + Math.random() * 7.2,
          rot: Math.random() * Math.PI * 2,
          rotSpd: (Math.random() - 0.5) * 4.5,
          phase: Math.random() * Math.PI * 2,
          rgb: palette[i % palette.length]
        });
      }
    }
    this._celebrationState = state;

    const renderFrame = (dt) => {
      state.elapsed += dt;
      const fadeOut = state.elapsed > state.duration - 0.85
        ? Math.max(0, (state.duration - state.elapsed) / 0.85)
        : Math.min(1, state.elapsed / 0.35);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Luminous festive radial flash wash during first 1.2s
      if (state.elapsed < 1.3) {
        const flashA = Math.sin((state.elapsed / 1.3) * Math.PI) * 0.22;
        const rg = ctx.createRadialGradient(w * 0.5, h * 0.42, 10, w * 0.5, h * 0.42, Math.max(w, h) * 0.65);
        rg.addColorStop(0, `rgba(${palette[0]}, ${flashA.toFixed(3)})`);
        rg.addColorStop(0.55, `rgba(${palette[1]}, ${(flashA * 0.45).toFixed(3)})`);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }

      // Draw aerial fireworks bursts (New Year / National Day / Diwali)
      for (let i = 0; i < state.bursts.length; i++) {
        const b = state.bursts[i];
        const age = state.elapsed - b.delay;
        if (age < 0 || age > 1.75) continue;
        const prog = age / 1.75;
        const alpha = (1 - prog * prog) * fadeOut;
        for (let r = 0; r < b.sparks.length; r++) {
          const sp = b.sparks[r];
          const sx = b.x + Math.cos(sp.ang) * sp.spd * age * (1 - prog * 0.28);
          const sy = b.y + Math.sin(sp.ang) * sp.spd * age * (1 - prog * 0.28) + 46 * age * age;
          const tailX = b.x + Math.cos(sp.ang) * sp.spd * Math.max(0, age - 0.11);
          const tailY = b.y + Math.sin(sp.ang) * sp.spd * Math.max(0, age - 0.11) + 46 * Math.max(0, age - 0.11) ** 2;
          ctx.strokeStyle = `rgba(${b.rgb}, ${(alpha * 0.72).toFixed(3)})`;
          ctx.lineWidth = sp.size * 0.85;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(sx, sy);
          ctx.stroke();
          ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.95).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, sp.size * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Halloween soaring bats
      for (let i = 0; i < state.bats.length; i++) {
        const bt = state.bats[i];
        bt.x += bt.vx * dt;
        bt.y += bt.vy * dt + Math.sin(state.elapsed * 5 + i) * 24 * dt;
        bt.wingPhase += dt * 15;
        const flap = Math.sin(bt.wingPhase) * 9;
        ctx.save();
        ctx.translate(bt.x, bt.y);
        ctx.scale(bt.scale, bt.scale);
        ctx.fillStyle = `rgba(17, 12, 34, ${(0.88 * fadeOut).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.quadraticCurveTo(-11, -12 + flap, -22, 1 + flap * 0.5);
        ctx.quadraticCurveTo(-11, 4, 0, 5);
        ctx.quadraticCurveTo(11, 4, 22, 1 + flap * 0.5);
        ctx.quadraticCurveTo(11, -12 + flap, 0, -3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw themed celebration particles
      for (let i = 0; i < state.items.length; i++) {
        const it = state.items[i];
        it.phase += dt * 3.2;
        it.x += it.vx * dt + Math.sin(it.phase) * 28 * dt;
        it.y += it.vy * dt;
        it.rot += (it.rotSpd || 1.2) * dt;
        const a = 0.88 * fadeOut;
        if (a <= 0.01) continue;

        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        if (fam === "lantern" || fam === "mid_autumn") {
          const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, it.size * 1.9);
          halo.addColorStop(0, `rgba(${it.rgb}, ${(a * 0.55).toFixed(3)})`);
          halo.addColorStop(1, `rgba(${it.rgb}, 0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(0, 0, it.size * 1.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${it.rgb}, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.roundRect(-it.size * 0.55, -it.size * 0.72, it.size * 1.1, it.size * 1.44, it.size * 0.35);
          ctx.fill();
          ctx.fillStyle = `rgba(254, 240, 138, ${a.toFixed(3)})`;
          ctx.fillRect(-it.size * 0.25, it.size * 0.62, it.size * 0.5, it.size * 0.16);
        } else if (fam === "christmas") {
          ctx.strokeStyle = `rgba(241, 245, 249, ${a.toFixed(3)})`;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          for (let k = 0; k < 3; k++) {
            const ang = (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * it.size, Math.sin(ang) * it.size);
            ctx.lineTo(-Math.cos(ang) * it.size, -Math.sin(ang) * it.size);
            ctx.stroke();
          }
          ctx.fillStyle = `rgba(${it.rgb}, ${(a * 0.8).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(0, 0, 2.0, 0, Math.PI * 2);
          ctx.fill();
        } else if (fam === "valentines") {
          const hs = it.size * 0.85;
          ctx.fillStyle = `rgba(${it.rgb}, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(0, hs * 0.35);
          ctx.bezierCurveTo(-hs, -hs * 0.45, -hs * 0.5, -hs * 1.15, 0, -hs * 0.4);
          ctx.bezierCurveTo(hs * 0.5, -hs * 1.15, hs, -hs * 0.45, 0, hs * 0.35);
          ctx.fill();
        } else if (fam === "thanksgiving") {
          ctx.fillStyle = `rgba(${it.rgb}, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(0, -it.size);
          ctx.lineTo(it.size * 0.45, -it.size * 0.25);
          ctx.lineTo(it.size * 0.95, -it.size * 0.1);
          ctx.lineTo(it.size * 0.4, it.size * 0.45);
          ctx.lineTo(0, it.size * 0.9);
          ctx.lineTo(-it.size * 0.4, it.size * 0.45);
          ctx.lineTo(-it.size * 0.95, -it.size * 0.1);
          ctx.lineTo(-it.size * 0.45, -it.size * 0.25);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${it.rgb}, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, it.size, it.size * 0.56, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    };

    // Draw initial burst frame immediately so headless snapshots & first frame show cleanly
    renderFrame(0);

    let lastTs = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0.008, (now - lastTs) / 1000));
      lastTs = now;
      renderFrame(dt);
      if (state.elapsed < state.duration) {
        this._celebrationRaf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = "none";
        this._celebrationRaf = null;
      }
    };
    this._celebrationRaf = requestAnimationFrame(tick);
  },

  triggerCelebration(holiday) {
    const hol = holiday || this.getActiveHoliday();
    if (!hol || !hol.name) return;
    this.showHolidayFactPopup(hol);
    this.launchFullScreenAnimation(hol);
  }
};

window.HolidayThemes = HolidayThemes;
