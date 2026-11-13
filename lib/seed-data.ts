// Data seed: 26 template bawaan dari brief + example world "Arunika".
// Dipakai prisma/seed.ts (template bawaan) dan API contoh dunia (Arunika).

export type TemplateFieldDef = {
  key: string;
  label: string;
  type:
    | "text"
    | "longtext"
    | "number"
    | "date"
    | "dropdown"
    | "multiselect"
    | "checkbox"
    | "image"
    | "url"
    | "entity"
    | "repeater";
  required?: boolean;
  options?: string[];
  prompt?: string;
  order: number;
};

export type BuiltinTemplateDef = {
  name: string;
  description: string;
  fields: TemplateFieldDef[];
};

const f = (
  key: string,
  label: string,
  type: TemplateFieldDef["type"],
  order: number,
  extra?: Partial<TemplateFieldDef>,
): TemplateFieldDef => ({ key, label, type, order, ...extra });

export const BUILTIN_TEMPLATES: BuiltinTemplateDef[] = [
  {
    name: "Character",
    description: "Tokoh: pahlawan, penjahat, NPC, atau siapa pun yang hidup di duniamu.",
    fields: [
      f("fullName", "Nama Lengkap", "text", 1, { required: true }),
      f("alias", "Alias / Nama Panggilan", "text", 2),
      f("age", "Usia", "text", 3),
      f("gender", "Gender", "dropdown", 4, { options: ["Perempuan", "Laki-laki", "Non-biner", "Lainnya"] }),
      f("species", "Spesies / Ras", "entity", 5),
      f("occupation", "Pekerjaan / Peran", "text", 6),
      f("personality", "Kepribadian", "longtext", 7),
      f("motivation", "Motivasi", "longtext", 8),
      f("background", "Latar Belakang", "longtext", 9),
      f("characterArc", "Perkembangan Karakter (Arc)", "longtext", 10),
      f("strengths", "Kelebihan", "longtext", 11),
      f("weaknesses", "Kelemahan", "longtext", 12),
      f("skills", "Keterampilan", "longtext", 13),
      f("abilities", "Kemampuan Khusus", "longtext", 14),
      f("appearance", "Penampilan", "longtext", 15),
      f("costume", "Pakaian / Kostum", "longtext", 16),
      f("voice", "Suara / Cara Bicara", "text", 17),
      f("relationships", "Relasi", "entity", 18),
      f("relatedLocations", "Lokasi Terkait", "entity", 19),
      f("relatedOrganizations", "Organisasi Terkait", "entity", 20),
    ],
  },
  {
    name: "Condition",
    description: "Kondisi, status, kutukan, penyakit, atau keadaan yang memengaruhi tokoh dan dunia.",
    fields: [
      f("name", "Nama Kondisi", "text", 1, { required: true }),
      f("type", "Jenis", "dropdown", 2, { options: ["Penyakit", "Kutukan", "Berkah", "Status", "Lainnya"] }),
      f("description", "Deskripsi", "longtext", 3),
      f("effects", "Efek", "longtext", 4),
      f("cure", "Cara Mengatasi", "longtext", 5),
    ],
  },
  {
    name: "Document",
    description: "Dokumen dalam dunia: surat, kitab, perjanjian, atau catatan resmi.",
    fields: [
      f("title", "Judul Dokumen", "text", 1, { required: true }),
      f("author", "Penulis", "text", 2),
      f("date", "Tanggal", "date", 3),
      f("content", "Isi Dokumen", "longtext", 4),
      f("significance", "Signifikansi", "longtext", 5),
    ],
  },
  {
    name: "Ethnicity / Culture",
    description: "Suku, etnis, atau budaya yang hidup di duniamu.",
    fields: [
      f("name", "Nama Etnis / Budaya", "text", 1, { required: true }),
      f("homeland", "Tanah Asal", "entity", 2),
      f("language", "Bahasa", "entity", 3),
      f("customs", "Adat & Tradisi", "longtext", 4),
      f("values", "Nilai-nilai", "longtext", 5),
      f("appearance", "Ciri Fisik Khas", "longtext", 6),
    ],
  },
  {
    name: "Military Unit",
    description: "Kesatuan militer, pasukan, atau armada.",
    fields: [
      f("name", "Nama Kesatuan", "text", 1, { required: true }),
      f("type", "Jenis", "dropdown", 2, { options: ["Infanteri", "Kavaleri", "Pemanah", "Armada Laut", "Udara", "Campuran"] }),
      f("size", "Jumlah Personel", "number", 3),
      f("commander", "Komandan", "entity", 4),
      f("allegiance", "Loyalitas", "entity", 5),
      f("history", "Sejarah", "longtext", 6),
    ],
  },
  {
    name: "Item",
    description: "Benda: senjata, artefak, perkakas, atau barang berharga.",
    fields: [
      f("name", "Nama Benda", "text", 1, { required: true }),
      f("type", "Jenis", "dropdown", 2, { options: ["Senjata", "Artefak", "Perkakas", "Pakaian", "Ramuan", "Lainnya"] }),
      f("description", "Deskripsi", "longtext", 3),
      f("properties", "Sifat / Kekuatan", "longtext", 4),
      f("owner", "Pemilik", "entity", 5),
      f("origin", "Asal-usul", "longtext", 6),
    ],
  },
  {
    name: "Language",
    description: "Bahasa yang dipakai di duniamu.",
    fields: [
      f("name", "Nama Bahasa", "text", 1, { required: true }),
      f("script", "Aksara", "text", 2),
      f("speakers", "Penutur", "entity", 3),
      f("grammar", "Tata Bahasa", "longtext", 4),
      f("sample", "Contoh Frasa", "longtext", 5),
    ],
  },
  {
    name: "Material",
    description: "Material: logam, kayu, kristal, atau zat lain yang penting di dunia.",
    fields: [
      f("name", "Nama Material", "text", 1, { required: true }),
      f("properties", "Sifat", "longtext", 2),
      f("uses", "Kegunaan", "longtext", 3),
      f("rarity", "Kelangkaan", "dropdown", 4, { options: ["Umum", "Jarang", "Langka", "Legendaris"] }),
      f("foundIn", "Ditemukan di", "entity", 5),
    ],
  },
  {
    name: "Conflict",
    description: "Konflik: perang, perselisihan, atau pertentangan besar.",
    fields: [
      f("name", "Nama Konflik", "text", 1, { required: true }),
      f("parties", "Pihak yang Terlibat", "entity", 2),
      f("cause", "Penyebab", "longtext", 3),
      f("timeline", "Jangka Waktu", "text", 4),
      f("outcome", "Hasil / Akhir", "longtext", 5),
      f("consequences", "Dampak", "longtext", 6),
    ],
  },
  {
    name: "Myth / Legend",
    description: "Mitos dan legenda yang diceritakan di duniamu.",
    fields: [
      f("title", "Judul Mitos", "text", 1, { required: true }),
      f("origin", "Asal Cerita", "entity", 2),
      f("story", "Cerita", "longtext", 3),
      f("moral", "Pesan / Makna", "longtext", 4),
      f("variations", "Variasi Cerita", "longtext", 5),
    ],
  },
  {
    name: "Location - Building",
    description: "Bangunan: istana, kuil, menara, rumah, atau tempat spesifik lainnya.",
    fields: [
      f("name", "Nama Bangunan", "text", 1, { required: true }),
      f("location", "Lokasi", "entity", 2),
      f("purpose", "Fungsi", "text", 3),
      f("description", "Deskripsi", "longtext", 4),
      f("history", "Sejarah", "longtext", 5),
      f("inhabitants", "Penghuni", "entity", 6),
    ],
  },
  {
    name: "Location - Geographic",
    description: "Fitur geografis: gunung, laut, hutan, gurun, sungai, dan sejenisnya.",
    fields: [
      f("name", "Nama Lokasi", "text", 1, { required: true }),
      f("type", "Jenis", "dropdown", 2, { options: ["Gunung", "Laut", "Hutan", "Gurun", "Sungai", "Pulau", "Lembah", "Lainnya"] }),
      f("climate", "Iklim", "text", 3),
      f("description", "Deskripsi", "longtext", 4),
      f("floraFauna", "Flora & Fauna", "longtext", 5),
      f("dangers", "Bahaya", "longtext", 6),
    ],
  },
  {
    name: "Location - Settlement",
    description: "Permukiman: kota, desa, ibu kota, atau pelabuhan.",
    fields: [
      f("name", "Nama Permukiman", "text", 1, { required: true }),
      f("type", "Jenis", "dropdown", 2, { options: ["Ibu Kota", "Kota", "Desa", "Pelabuhan", "Kubu", "Kampung"] }),
      f("population", "Populasi", "number", 3),
      f("ruler", "Penguasa", "entity", 4),
      f("description", "Deskripsi", "longtext", 5),
      f("economy", "Ekonomi", "longtext", 6),
      f("landmarks", "Tempat Penting", "entity", 7),
    ],
  },
  {
    name: "Natural Law",
    description: "Hukum alam atau hukum sihir yang mengatur duniamu.",
    fields: [
      f("name", "Nama Hukum", "text", 1, { required: true }),
      f("description", "Deskripsi", "longtext", 2),
      f("limitations", "Batasan", "longtext", 3),
      f("exceptions", "Pengecualian", "longtext", 4),
    ],
  },
  {
    name: "Organization",
    description: "Organisasi: guild, kerajaan, sekte, perusahaan, atau perkumpulan.",
    fields: [
      f("name", "Nama Organisasi", "text", 1, { required: true }),
      f("type", "Jenis", "dropdown", 2, { options: ["Kerajaan", "Guild", "Sekte", "Perusahaan", "Militer", "Komunitas"] }),
      f("leader", "Pemimpin", "entity", 2),
      f("headquarters", "Markas", "entity", 3),
      f("goals", "Tujuan", "longtext", 4),
      f("structure", "Struktur", "longtext", 5),
      f("history", "Sejarah", "longtext", 6),
      f("members", "Anggota Penting", "entity", 7),
    ],
  },
  {
    name: "Prose",
    description: "Prosa bebas: cuplikan cerita, deskripsi suasana, atau tulisan naratif.",
    fields: [
      f("title", "Judul", "text", 1, { required: true }),
      f("excerpt", "Cuplikan", "longtext", 2),
      f("mood", "Suasana", "text", 3),
    ],
  },
  {
    name: "Profession",
    description: "Profesi atau pekerjaan di duniamu.",
    fields: [
      f("name", "Nama Profesi", "text", 1, { required: true }),
      f("description", "Deskripsi", "longtext", 2),
      f("skills", "Keterampilan yang Dibutuhkan", "longtext", 3),
      f("tools", "Peralatan", "longtext", 4),
      f("socialStatus", "Status Sosial", "text", 5),
    ],
  },
  {
    name: "Plot",
    description: "Alur cerita: rangkaian peristiwa dalam sebuah kisah.",
    fields: [
      f("title", "Judul Alur", "text", 1, { required: true }),
      f("premise", "Premis", "longtext", 2),
      f("acts", "Babak / Struktur", "longtext", 3),
      f("twist", "Plot Twist", "longtext", 4),
      f("characters", "Tokoh Terlibat", "entity", 5),
    ],
  },
  {
    name: "Title",
    description: "Gelar atau pangkat yang dipakai di duniamu.",
    fields: [
      f("name", "Nama Gelar", "text", 1, { required: true }),
      f("meaning", "Arti", "longtext", 2),
      f("holders", "Penyandang", "entity", 3),
      f("requirements", "Syarat Memperoleh", "longtext", 4),
    ],
  },
  {
    name: "Session Report",
    description: "Laporan sesi permainan RPG: ringkasan apa yang terjadi di meja.",
    fields: [
      f("title", "Judul Sesi", "text", 1, { required: true }),
      f("date", "Tanggal Sesi", "date", 2),
      f("party", "Party / Pemain", "entity", 3),
      f("summary", "Ringkasan", "longtext", 4),
      f("highlights", "Momen Penting", "longtext", 5),
    ],
  },
  {
    name: "Species",
    description: "Spesies: makhluk hidup, ras, atau binatang di duniamu.",
    fields: [
      f("name", "Nama Spesies", "text", 1, { required: true }),
      f("habitat", "Habitat", "entity", 2),
      f("description", "Deskripsi", "longtext", 3),
      f("behavior", "Perilaku", "longtext", 4),
      f("abilities", "Kemampuan", "longtext", 5),
      f("threat", "Tingkat Ancaman", "dropdown", 6, { options: ["Jinak", "Waspada", "Berbahaya", "Mematikan"] }),
    ],
  },
  {
    name: "Spell",
    description: "Mantra atau sihir.",
    fields: [
      f("name", "Nama Mantra", "text", 1, { required: true }),
      f("school", "Aliran", "text", 2),
      f("effect", "Efek", "longtext", 3),
      f("cost", "Biaya / Harga", "text", 4),
      f("casting", "Cara Merapal", "longtext", 5),
    ],
  },
  {
    name: "Technology",
    description: "Teknologi: alat, mesin, atau penemuan.",
    fields: [
      f("name", "Nama Teknologi", "text", 1, { required: true }),
      f("description", "Deskripsi", "longtext", 2),
      f("inventor", "Penemu", "entity", 3),
      f("uses", "Kegunaan", "longtext", 4),
      f("limitations", "Keterbatasan", "longtext", 5),
    ],
  },
  {
    name: "Tradition / Ritual",
    description: "Tradisi atau ritual yang dijalankan di duniamu.",
    fields: [
      f("name", "Nama Tradisi", "text", 1, { required: true }),
      f("occasion", "Kapan Dilakukan", "text", 2),
      f("steps", "Tahapan", "longtext", 3),
      f("meaning", "Makna", "longtext", 4),
      f("participants", "Pelaku", "entity", 5),
    ],
  },
  {
    name: "Vehicle",
    description: "Kendaraan: kapal, kereta, tunggangan, atau mesin terbang.",
    fields: [
      f("name", "Nama Kendaraan", "text", 1, { required: true }),
      f("type", "Jenis", "dropdown", 2, { options: ["Darat", "Laut", "Udara", "Tunggangan", "Magis"] }),
      f("description", "Deskripsi", "longtext", 2),
      f("capacity", "Kapasitas", "text", 3),
      f("speed", "Kecepatan", "text", 4),
    ],
  },
  {
    name: "Generic Article",
    description: "Artikel umum tanpa field khusus — bebas diisi apa pun.",
    fields: [f("summary", "Ringkasan", "longtext", 1)],
  },
];

// ---------------------------------------------------------------------------
// Example world "Arunika" — 7 artikel, 6 relasi.
// ---------------------------------------------------------------------------

export const ARUNIKA = {
  name: "Arunika",
  description:
    "Kepulauan di ujung barat yang diterangi dua matahari kembar. Di sini laut pasang membawa paus langit, dan suar karang emas menjadi penanda pulang bagi para pelaut.",
  genre: "Fantasi",
  tags: ["kepulauan", "fantasi", "laut"],
  categories: ["Dunia", "Karakter", "Lokasi", "Organisasi", "Peristiwa"],
  articles: [
    {
      title: "Arunika",
      template: "Generic Article",
      category: "Dunia",
      status: "PUBLISHED" as const,
      content: `# Arunika

Arunika adalah kepulauan di ujung barat, diterangi dua matahari kembar yang terbit bergantian. Laut di sekelilingnya pasang dua kali sehari, dan setiap pasang membawa kawanan [[Paus Langit]] yang berenang di antara awan.

Para pelaut pulang dengan mengikuti cahaya [[Suar Karang Emas]] — menara karang yang menyala keemasan setiap senja. Tanpa suar itu, kapal-kapal akan tersesat di kabut pasang.

Ibu kota kepulauan ini adalah [[Kota Pelabuhan Tirta Amerta]], tempat para pedagang, pelaut, dan penjaga pasang berkumpul.`,
    },
    {
      title: "Suar Karang Emas",
      template: "Location - Geographic",
      category: "Lokasi",
      status: "PUBLISHED" as const,
      content: `# Suar Karang Emas

Menara karang setinggi sembilan puluh meter yang tumbuh dari laut dangkal di barat Arunika. Pada senja hari, karang itu memancarkan cahaya keemasan yang terlihat dari seluruh kepulauan.

[[Ordo Penjaga Pasang]] menjaga suar ini turun-temurun. Mereka percaya cahaya suar adalah napas terakhir naga laut yang tidur di bawah karang.

Setiap musim pasang besar, kawanan [[Paus Langit]] berenang melingkari suar sebelum menghilang ke balik awan.`,
    },
    {
      title: "Paus Langit",
      template: "Species",
      category: "Dunia",
      status: "PUBLISHED" as const,
      content: `# Paus Langit

Paus raksasa yang berenang di udara, bukan di air. Tubuhnya sepanjang tiga kapal, kulitnya berkilau seperti langit senja, dan nyanyiannya terdengar setiap kali pasang naik.

Paus langit hanya muncul di dekat [[Suar Karang Emas]] saat musim pasang besar. Para nelayan Arunika menganggap kemunculan mereka sebagai pertanda musim tangkap yang baik — atau pertanda badai, tergantung arah renangnya.`,
    },
    {
      title: "Kota Pelabuhan Tirta Amerta",
      template: "Location - Settlement",
      category: "Lokasi",
      status: "PUBLISHED" as const,
      content: `# Kota Pelabuhan Tirta Amerta

Ibu kota Arunika dan pelabuhan tersibuk di kepulauan. Dermaganya tidak pernah sepi: kapal dagang dari timur, perahu nelayan, dan kapal penjaga pasang bersandar berdampingan.

Kota ini dibangun di atas rawa yang dikeringkan tiga generasi lalu. Di sinilah [[Nara Kirana]] dibesarkan, sebelum ia bergabung dengan [[Ordo Penjaga Pasang]].

[[Perang Pasang Kedua]] pernah membakar separuh dermaga kota ini — bekasnya masih terlihat di dermaga tua sebelah barat.`,
    },
    {
      title: "Nara Kirana",
      template: "Character",
      category: "Karakter",
      status: "PUBLISHED" as const,
      content: `# Nara Kirana

Penjaga pasang termuda yang pernah mengangkat sumpah di [[Suar Karang Emas]]. Ia lahir di [[Kota Pelabuhan Tirta Amerta]] dari keluarga nelayan, dan sejak kecil ia bisa mendengar nyanyian [[Paus Langit]] — kemampuan yang hanya dimiliki segelintir orang.

Nara bertugas menjaga suar bersama [[Ordo Penjaga Pasang]]. Ia keras kepala, tidak sabaran, tapi tidak pernah meninggalkan posnya — bahkan saat [[Perang Pasang Kedua]] mencapai gerbang kota.`,
    },
    {
      title: "Ordo Penjaga Pasang",
      template: "Organization",
      category: "Organisasi",
      status: "PUBLISHED" as const,
      content: `# Ordo Penjaga Pasang

Ordo kuno yang menjaga [[Suar Karang Emas]] dan mengatur lalu lintas kapal saat pasang besar. Anggotanya dipilih dari keluarga pelaut dan nelayan di seluruh Arunika.

Markas ordo berada di kaki suar. Mereka juga yang pertama memperingatkan kota saat [[Perang Pasang Kedua]] pecah, dan merekalah yang memadamkan api di dermaga [[Kota Pelabuhan Tirta Amerta]].

[[Nara Kirana]] adalah anggota termuda ordo ini.`,
    },
    {
      title: "Perang Pasang Kedua",
      template: "Conflict",
      category: "Peristiwa",
      status: "PUBLISHED" as const,
      content: `# Perang Pasang Kedua

Perang saudara yang pecah saat pasang besar tahun ke-312 penanggalan Arunika. Dua kubu memperebutkan kendali atas [[Suar Karang Emas]] dan jalur dagang ke [[Kota Pelabuhan Tirta Amerta]].

Perang ini berakhir setelah tiga musim, ketika [[Ordo Penjaga Pasang]] memadamkan suar selama tujuh malam — memaksa kedua kubu berunding dalam gelap.

Bekas perang masih terlihat: dermaga tua yang hangus, dan larangan menyalakan api di dekat suar.`,
    },
  ],
  relationships: [
    { from: "Nara Kirana", to: "Ordo Penjaga Pasang", type: "Anggota" },
    { from: "Nara Kirana", to: "Kota Pelabuhan Tirta Amerta", type: "Tinggal di" },
    { from: "Ordo Penjaga Pasang", to: "Suar Karang Emas", type: "Menjaga" },
    { from: "Paus Langit", to: "Suar Karang Emas", type: "Muncul di" },
    { from: "Perang Pasang Kedua", to: "Kota Pelabuhan Tirta Amerta", type: "Terjadi di" },
    { from: "Perang Pasang Kedua", to: "Ordo Penjaga Pasang", type: "Melibatkan" },
  ],
};
