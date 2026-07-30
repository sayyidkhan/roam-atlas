export const REGION_CAPITALS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  malaysia: {
    johor: "Johor Bahru",
    sabah: "Kota Kinabalu",
    sarawak: "Kuching",
    penang: "George Town",
    melaka: "Malacca",
    "pulau pinang": "George Town"
  }
};

export const PLACE_LANDMARK_QUERIES: Readonly<
  Record<
    string,
    Readonly<Record<string, readonly string[]>>
  >
> = {
  singapore: {
    "west campus and gardens": [
      "National University of Singapore Kent Ridge campus photograph",
      "Nanyang Technological University Singapore campus photograph",
      "Jurong Lake Gardens Singapore landscape photograph"
    ]
  },
  malaysia: {
    langkawi: [
      "Langkawi Sky Bridge Malaysia tourist landmark photograph",
      "Pantai Cenang Langkawi beach landmark photo",
      "Eagle Square Langkawi island landmark photograph",
      "Telaga Tujuh Waterfall Langkawi Malaysia travel photo"
    ],
    johor: [
      "Sultan Abu Bakar State Mosque Johor Bahru landmark photograph",
      "Legoland Malaysia Johor Bahru tourist attraction photo",
      "Johor Bahru old town heritage street landmark photo",
      "Puteri Harbour Johor Bahru waterfront landmark photograph"
    ]
  }
};

export const TOURIST_SCENE_TERMS = [
  "langkawi",
  "redang",
  "tioman",
  "pangkor",
  "boracay",
  "phuket",
  "bali",
  "maldives",
  "seychelles",
  "archipelago",
  "national park",
  "beach resort"
] as const;
