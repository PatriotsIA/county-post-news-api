import type { CountyNativeSource } from "./source-registry.js";

export type ReviewedSupplementalSource = CountyNativeSource & {
  id: string;
  countyFips: string[];
  coverage: "local" | "regional" | "statewide";
  trustedForCountyTier: false;
  coverageUrl: string;
  review: {
    status: "approved";
    reviewedAt: string;
    evidenceUrls: string[];
    basis: string;
  };
};

// Reviewed 2026-09-10; evidence and deferred decisions: docs/source-expansion-2026-09-10/.
// Reviewed 2026-09-10; evidence and deferred decisions: docs/source-expansion-2026-09-10/.
// Reviewed 2026-09-10; evidence and deferred decisions: docs/source-expansion-2026-09-10/.
// Reviewed 2026-09-10; evidence and deferred decisions: docs/source-expansion-2026-09-10/.
export const reviewedSupplementalSources: ReviewedSupplementalSource[] = [
  {
    "id": "addisonindependent-com",
    "name": "Addison Independent",
    "websiteUrl": "https://addisonindependent.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "vermont/addison"
    ],
    "countyFips": [
      "50001"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.addisonindependent.com/contact/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.addisonindependent.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://addisonindependent.com/",
        "https://www.addisonindependent.com/contact/",
        "https://www.addisonindependent.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "berksweekly-com",
    "name": "Berks Weekly",
    "websiteUrl": "https://berksweekly.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "pennsylvania/berks"
    ],
    "countyFips": [
      "42011"
    ],
    "coverage": "local",
    "coverageUrl": "https://berksweekly.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://berksweekly.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://berksweekly.com/",
        "https://berksweekly.com/about/",
        "https://berksweekly.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "buckrail-com",
    "name": "Buckrail",
    "websiteUrl": "https://buckrail.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "wyoming/teton"
    ],
    "countyFips": [
      "56039"
    ],
    "coverage": "local",
    "coverageUrl": "https://buckrail.com/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://buckrail.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://buckrail.com/",
        "https://buckrail.com/about-us/",
        "https://buckrail.com/feed/"
      ],
      "basis": "Jackson Hole newsroom in Teton County, Wyoming. Idaho search observation is not sufficient to approve a separate county listing."
    }
  },
  {
    "id": "cobbcountycourier-com",
    "name": "Cobb Courier",
    "websiteUrl": "https://cobbcountycourier.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "georgia/cobb"
    ],
    "countyFips": [
      "13067"
    ],
    "coverage": "local",
    "coverageUrl": "https://cobbcountycourier.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://cobbcountycourier.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://cobbcountycourier.com/",
        "https://cobbcountycourier.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "county17-com",
    "name": "County 17",
    "websiteUrl": "https://county17.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "wyoming/campbell"
    ],
    "countyFips": [
      "56005"
    ],
    "coverage": "local",
    "coverageUrl": "https://county17.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://county17.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://county17.com/",
        "https://county17.com/about/",
        "https://county17.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "demingheadlight-com",
    "name": "Deming Headlight",
    "websiteUrl": "https://demingheadlight.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "new-mexico/luna"
    ],
    "countyFips": [
      "35029"
    ],
    "coverage": "local",
    "coverageUrl": "https://demingheadlight.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.demingheadlight.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://demingheadlight.com/",
        "https://www.demingheadlight.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "duboiscountyfreepress-com",
    "name": "Dubois County Free Press",
    "websiteUrl": "https://duboiscountyfreepress.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "indiana/dubois"
    ],
    "countyFips": [
      "18037"
    ],
    "coverage": "local",
    "coverageUrl": "https://duboiscountyfreepress.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://duboiscountyfreepress.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://duboiscountyfreepress.com/",
        "https://duboiscountyfreepress.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "fcnp-com",
    "name": "Falls Church News-Press",
    "websiteUrl": "https://fcnp.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "virginia/falls-church"
    ],
    "countyFips": [
      "51610"
    ],
    "coverage": "local",
    "coverageUrl": "https://fcnp.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.fcnp.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://fcnp.com/",
        "https://www.fcnp.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "fergusfallsjournal-com",
    "name": "Fergus Falls Journal",
    "websiteUrl": "https://fergusfallsjournal.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "minnesota/otter-tail"
    ],
    "countyFips": [
      "27111"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.fergusfallsjournal.com/contact-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.fergusfallsjournal.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://fergusfallsjournal.com/",
        "https://www.fergusfallsjournal.com/contact-us",
        "https://www.fergusfallsjournal.com/index.rss"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "milanmirrorexchange-com",
    "name": "Gibson County News / Milan Mirror-Exchange",
    "websiteUrl": "https://milanmirrorexchange.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "tennessee/gibson"
    ],
    "countyFips": [
      "47053"
    ],
    "coverage": "local",
    "coverageUrl": "https://milanmirrorexchange.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.milanmirrorexchange.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://milanmirrorexchange.com/",
        "https://www.milanmirrorexchange.com/feed/"
      ],
      "basis": "Current masthead is Gibson County News. Preserve the historical Milan Mirror-Exchange name as an alias; scope to Gibson County, Tennessee."
    },
    "aliases": [
      "Milan Mirror Exchange"
    ]
  },
  {
    "id": "henricocitizen-com",
    "name": "Henrico Citizen",
    "websiteUrl": "https://henricocitizen.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "virginia/henrico"
    ],
    "countyFips": [
      "51087"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.henricocitizen.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.henricocitizen.com/latest/rss/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://henricocitizen.com/",
        "https://www.henricocitizen.com/about/",
        "https://www.henricocitizen.com/latest/rss/"
      ],
      "basis": "Publisher explicitly identifies Henrico County, Virginia; same-name/city observations are excluded."
    }
  },
  {
    "id": "iredellfreenews-com",
    "name": "Iredell Free News",
    "websiteUrl": "https://iredellfreenews.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "north-carolina/iredell"
    ],
    "countyFips": [
      "37097"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.iredellfreenews.com/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.iredellfreenews.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://iredellfreenews.com/",
        "https://www.iredellfreenews.com/about-us/",
        "https://www.iredellfreenews.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "lakeconews-com",
    "name": "Lake County News",
    "websiteUrl": "https://lakeconews.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "california/lake"
    ],
    "countyFips": [
      "06033"
    ],
    "coverage": "local",
    "coverageUrl": "https://lakeconews.com/en/contact-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://lakeconews.com/en/?format=feed&type=rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://lakeconews.com/",
        "https://lakeconews.com/en/contact-us",
        "https://lakeconews.com/en/?format=feed&type=rss"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "losalamosreporter-com",
    "name": "Los Alamos Reporter",
    "websiteUrl": "https://losalamosreporter.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "new-mexico/los-alamos"
    ],
    "countyFips": [
      "35028"
    ],
    "coverage": "local",
    "coverageUrl": "https://losalamosreporter.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://losalamosreporter.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://losalamosreporter.com/",
        "https://losalamosreporter.com/about/",
        "https://losalamosreporter.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "watfordcitynd-com",
    "name": "McKenzie County Farmer",
    "websiteUrl": "https://watfordcitynd.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "north-dakota/mckenzie"
    ],
    "countyFips": [
      "38053"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.watfordcitynd.com/contact-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.watfordcitynd.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://watfordcitynd.com/",
        "https://www.watfordcitynd.com/contact-us",
        "https://www.watfordcitynd.com/index.rss"
      ],
      "basis": "Publisher explicitly identifies Watford City and McKenzie County, North Dakota; erroneous additional counties are excluded."
    }
  },
  {
    "id": "memphisflyer-com",
    "name": "Memphis Flyer",
    "websiteUrl": "https://memphisflyer.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "tennessee/shelby"
    ],
    "countyFips": [
      "47157"
    ],
    "coverage": "local",
    "coverageUrl": "https://memphisflyer.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.memphisflyer.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://memphisflyer.com/",
        "https://www.memphisflyer.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "observertoday-com",
    "name": "Observer Today",
    "websiteUrl": "https://observertoday.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "new-york/chautauqua"
    ],
    "countyFips": [
      "36013"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.observertoday.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.observertoday.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://observertoday.com/",
        "https://www.observertoday.com/contact-us/",
        "https://www.observertoday.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "aroundosceola-com",
    "name": "Osceola News Gazette",
    "websiteUrl": "https://aroundosceola.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "florida/osceola"
    ],
    "countyFips": [
      "12097"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.aroundosceola.com/contact",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.aroundosceola.com/rss.xml"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://aroundosceola.com/",
        "https://www.aroundosceola.com/contact",
        "https://www.aroundosceola.com/rss.xml"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "bupipedream-com",
    "name": "Pipe Dream",
    "websiteUrl": "https://bupipedream.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "new-york/broome"
    ],
    "countyFips": [
      "36007"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.bupipedream.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.bupipedream.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://bupipedream.com/",
        "https://www.bupipedream.com/about/",
        "https://www.bupipedream.com/feed/"
      ],
      "basis": "Binghamton University student newspaper, located in Broome County, New York."
    }
  },
  {
    "id": "rocklandtimes-com",
    "name": "Rockland County Times",
    "websiteUrl": "https://rocklandtimes.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "new-york/rockland"
    ],
    "countyFips": [
      "36087"
    ],
    "coverage": "local",
    "coverageUrl": "https://rocklandtimes.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://rocklandtimes.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://rocklandtimes.com/",
        "https://rocklandtimes.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "santamariasun-com",
    "name": "Santa Maria Sun",
    "websiteUrl": "https://santamariasun.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "california/santa-barbara"
    ],
    "countyFips": [
      "06083"
    ],
    "coverage": "local",
    "coverageUrl": "https://santamariasun.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.santamariasun.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://santamariasun.com/",
        "https://www.santamariasun.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "redrocknews-com",
    "name": "Sedona Red Rock News",
    "websiteUrl": "https://redrocknews.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "arizona/yavapai"
    ],
    "countyFips": [
      "04025"
    ],
    "coverage": "local",
    "coverageUrl": "https://redrocknews.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.redrocknews.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://redrocknews.com/",
        "https://www.redrocknews.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "southwhidbeyrecord-com",
    "name": "South Whidbey Record",
    "websiteUrl": "https://southwhidbeyrecord.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "washington/island"
    ],
    "countyFips": [
      "53029"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.southwhidbeyrecord.com/services/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.southwhidbeyrecord.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://southwhidbeyrecord.com/",
        "https://www.southwhidbeyrecord.com/services/about/",
        "https://www.southwhidbeyrecord.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "spacecoastdaily-com",
    "name": "Space Coast Daily",
    "websiteUrl": "https://spacecoastdaily.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "florida/brevard"
    ],
    "countyFips": [
      "12009"
    ],
    "coverage": "local",
    "coverageUrl": "https://spacecoastdaily.com/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://spacecoastdaily.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://spacecoastdaily.com/",
        "https://spacecoastdaily.com/about-us/",
        "https://spacecoastdaily.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "statecollege-com",
    "name": "StateCollege.com",
    "websiteUrl": "https://statecollege.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "pennsylvania/centre"
    ],
    "countyFips": [
      "42027"
    ],
    "coverage": "local",
    "coverageUrl": "https://statecollege.com/",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statecollege.com/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "steamboatpilot-com",
    "name": "Steamboat Pilot & Today",
    "websiteUrl": "https://steamboatpilot.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "colorado/routt"
    ],
    "countyFips": [
      "08107"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.steamboatpilot.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.steamboatpilot.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://steamboatpilot.com/",
        "https://www.steamboatpilot.com/contact-us/",
        "https://www.steamboatpilot.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "stuttgartdailyleader-com",
    "name": "Stuttgart Daily Leader",
    "websiteUrl": "https://stuttgartdailyleader.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "arkansas/arkansas"
    ],
    "countyFips": [
      "05001"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.stuttgartdailyleader.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.stuttgartdailyleader.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://stuttgartdailyleader.com/",
        "https://www.stuttgartdailyleader.com/contact-us/",
        "https://www.stuttgartdailyleader.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "summitdaily-com",
    "name": "Summit Daily News",
    "websiteUrl": "https://summitdaily.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "colorado/summit"
    ],
    "countyFips": [
      "08117"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.summitdaily.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.summitdaily.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://summitdaily.com/",
        "https://www.summitdaily.com/contact-us/",
        "https://www.summitdaily.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "talbotspy-org",
    "name": "Talbot Spy",
    "websiteUrl": "https://talbotspy.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "maryland/talbot"
    ],
    "countyFips": [
      "24041"
    ],
    "coverage": "local",
    "coverageUrl": "https://talbotspy.org/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://talbotspy.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://talbotspy.org/",
        "https://talbotspy.org/about/",
        "https://talbotspy.org/about/contact-us/",
        "https://talbotspy.org/feed/"
      ],
      "basis": "Publisher about/contact pages explicitly identify the Talbot community newsroom; ignore a conflicting syndicated homepage metadata description."
    }
  },
  {
    "id": "tallahasseereports-com",
    "name": "Tallahassee Reports",
    "websiteUrl": "https://tallahasseereports.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "florida/leon"
    ],
    "countyFips": [
      "12073"
    ],
    "coverage": "local",
    "coverageUrl": "https://tallahasseereports.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://tallahasseereports.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://tallahasseereports.com/",
        "https://tallahasseereports.com/contact-us/",
        "https://tallahasseereports.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "badgerherald-com",
    "name": "The Badger Herald",
    "websiteUrl": "https://badgerherald.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "wisconsin/dane"
    ],
    "countyFips": [
      "55025"
    ],
    "coverage": "local",
    "coverageUrl": "https://badgerherald.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://badgerherald.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://badgerherald.com/",
        "https://badgerherald.com/about/",
        "https://badgerherald.com/feed/"
      ],
      "basis": "University of Wisconsin-Madison independent student newspaper, Dane County. Exclude the Winnebago observation."
    }
  },
  {
    "id": "thecentralvirginian-com",
    "name": "The Central Virginian",
    "websiteUrl": "https://thecentralvirginian.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "virginia/louisa"
    ],
    "countyFips": [
      "51109"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.thecentralvirginian.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.thecentralvirginian.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://thecentralvirginian.com/",
        "https://www.thecentralvirginian.com/contact-us/",
        "https://www.thecentralvirginian.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "theclaytontribune-com",
    "name": "The Clayton Tribune",
    "websiteUrl": "https://theclaytontribune.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "georgia/rabun"
    ],
    "countyFips": [
      "13241"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.theclaytontribune.com/contact",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.theclaytontribune.com/rss.xml"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://theclaytontribune.com/",
        "https://www.theclaytontribune.com/contact",
        "https://www.theclaytontribune.com/rss.xml"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "clermontsun-com",
    "name": "The Clermont Sun",
    "websiteUrl": "https://clermontsun.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "ohio/clermont"
    ],
    "countyFips": [
      "39025"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.clermontsun.com/contact-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.clermontsun.com/feed"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://clermontsun.com/",
        "https://www.clermontsun.com/contact-us",
        "https://www.clermontsun.com/feed"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "dailyillini-com",
    "name": "The Daily Illini",
    "websiteUrl": "https://dailyillini.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "illinois/champaign"
    ],
    "countyFips": [
      "17019"
    ],
    "coverage": "local",
    "coverageUrl": "https://dailyillini.com/contact/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://dailyillini.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://dailyillini.com/",
        "https://dailyillini.com/contact/",
        "https://dailyillini.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "dailyiowan-com",
    "name": "The Daily Iowan",
    "websiteUrl": "https://dailyiowan.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "iowa/johnson"
    ],
    "countyFips": [
      "19103"
    ],
    "coverage": "local",
    "coverageUrl": "https://dailyiowan.com/contact/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://dailyiowan.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://dailyiowan.com/",
        "https://dailyiowan.com/contact/",
        "https://dailyiowan.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "lockhaven-com",
    "name": "The Express - Lock Haven",
    "websiteUrl": "https://lockhaven.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "pennsylvania/clinton"
    ],
    "countyFips": [
      "42035"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.lockhaven.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.lockhaven.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://lockhaven.com/",
        "https://www.lockhaven.com/contact-us/",
        "https://www.lockhaven.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "thefallonpost-org",
    "name": "The Fallon Post",
    "websiteUrl": "https://thefallonpost.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "nevada/churchill"
    ],
    "countyFips": [
      "32001"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.thefallonpost.org/p/201/about-the-fallon-post",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.thefallonpost.org/rss/articles"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://thefallonpost.org/",
        "https://www.thefallonpost.org/p/201/about-the-fallon-post",
        "https://www.thefallonpost.org/rss/articles"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "highlandcountypress-com",
    "name": "The Highland County Press",
    "websiteUrl": "https://highlandcountypress.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "ohio/highland"
    ],
    "countyFips": [
      "39071"
    ],
    "coverage": "local",
    "coverageUrl": "https://highlandcountypress.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://highlandcountypress.com/rss.xml"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://highlandcountypress.com/",
        "https://highlandcountypress.com/rss.xml"
      ],
      "basis": "Hillsboro, Ohio newspaper; Highland County approved. Scioto search observation does not establish a separate county directory relationship."
    }
  },
  {
    "id": "sanjuanjournal-com",
    "name": "The Journal of the San Juan Islands",
    "websiteUrl": "https://sanjuanjournal.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "washington/san-juan"
    ],
    "countyFips": [
      "53055"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.sanjuanjournal.com/services/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.sanjuanjournal.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://sanjuanjournal.com/",
        "https://www.sanjuanjournal.com/services/about/",
        "https://www.sanjuanjournal.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "paisano-online-com",
    "name": "The Paisano",
    "websiteUrl": "https://paisano-online.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "texas/bexar"
    ],
    "countyFips": [
      "48029"
    ],
    "coverage": "local",
    "coverageUrl": "https://paisano-online.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://paisano-online.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://paisano-online.com/",
        "https://paisano-online.com/contact-us/",
        "https://paisano-online.com/feed/"
      ],
      "basis": "University of Texas at San Antonio independent student newspaper, Bexar County, Texas."
    }
  },
  {
    "id": "collegian-com",
    "name": "The Rocky Mountain Collegian",
    "websiteUrl": "https://collegian.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "colorado/larimer"
    ],
    "countyFips": [
      "08069"
    ],
    "coverage": "local",
    "coverageUrl": "https://collegian.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://collegian.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://collegian.com/",
        "https://collegian.com/feed/"
      ],
      "basis": "Colorado State University student newspaper in Fort Collins, Larimer County, Colorado."
    }
  },
  {
    "id": "lewistownsentinel-com",
    "name": "The Sentinel",
    "websiteUrl": "https://lewistownsentinel.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "pennsylvania/mifflin"
    ],
    "countyFips": [
      "42087"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.lewistownsentinel.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.lewistownsentinel.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://lewistownsentinel.com/",
        "https://www.lewistownsentinel.com/contact-us/",
        "https://www.lewistownsentinel.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "bendsource-com",
    "name": "The Source / Source Weekly",
    "websiteUrl": "https://bendsource.com/",
    "outletTypes": [
      "digital",
      "newspaper"
    ],
    "counties": [
      "oregon/deschutes"
    ],
    "countyFips": [
      "41017"
    ],
    "coverage": "local",
    "coverageUrl": "https://bendsource.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.bendsource.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://bendsource.com/",
        "https://www.bendsource.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "tillamookcountypioneer-net",
    "name": "Tillamook County Pioneer",
    "websiteUrl": "https://tillamookcountypioneer.net/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "oregon/tillamook"
    ],
    "countyFips": [
      "41057"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.tillamookcountypioneer.net/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.tillamookcountypioneer.net/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://tillamookcountypioneer.net/",
        "https://www.tillamookcountypioneer.net/about/",
        "https://www.tillamookcountypioneer.net/feed/"
      ],
      "basis": "Publisher explicitly identifies Tillamook County, Oregon. Clatsop observation is not sufficient for directory approval."
    }
  },
  {
    "id": "urbanmilwaukee-com",
    "name": "Urban Milwaukee",
    "websiteUrl": "https://urbanmilwaukee.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "wisconsin/milwaukee"
    ],
    "countyFips": [
      "55079"
    ],
    "coverage": "local",
    "coverageUrl": "https://urbanmilwaukee.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "http://feeds.feedburner.com/UrbanMilwaukee"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://urbanmilwaukee.com/",
        "https://urbanmilwaukee.com/about/",
        "http://feeds.feedburner.com/UrbanMilwaukee"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "whatsupnewp-com",
    "name": "What's Up Newp",
    "websiteUrl": "https://whatsupnewp.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "rhode-island/newport"
    ],
    "countyFips": [
      "44005"
    ],
    "coverage": "local",
    "coverageUrl": "https://whatsupnewp.com/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://whatsupnewp.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://whatsupnewp.com/",
        "https://whatsupnewp.com/about-us/",
        "https://whatsupnewp.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "willistonherald-com",
    "name": "Williston Herald",
    "websiteUrl": "https://willistonherald.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "north-dakota/williams"
    ],
    "countyFips": [
      "38105"
    ],
    "coverage": "local",
    "coverageUrl": "https://www.willistonherald.com/contact-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.willistonherald.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://willistonherald.com/",
        "https://www.willistonherald.com/contact-us",
        "https://www.willistonherald.com/index.rss"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "1380kcim-com",
    "name": "1380 KCIM",
    "websiteUrl": "https://1380kcim.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "iowa/carroll",
      "iowa/greene"
    ],
    "countyFips": [
      "19027",
      "19073"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.1380kcim.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://1380kcim.com/",
        "https://www.1380kcim.com/contact-us/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "turnto23-com",
    "name": "23ABC News Bakersfield",
    "websiteUrl": "https://turnto23.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "california/kern"
    ],
    "countyFips": [
      "06029"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.turnto23.com/about",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.turnto23.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://turnto23.com/",
        "https://www.turnto23.com/about",
        "https://www.turnto23.com/index.rss"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "abc57-com",
    "name": "ABC57",
    "websiteUrl": "https://abc57.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "indiana/st-joseph",
      "indiana/elkhart",
      "indiana/marshall",
      "michigan/berrien"
    ],
    "countyFips": [
      "18141",
      "18039",
      "18099",
      "26021"
    ],
    "coverage": "regional",
    "coverageUrl": "https://abc57.com/about",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://abc57.com/rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://abc57.com/",
        "https://abc57.com/about",
        "https://abc57.com/rss"
      ],
      "basis": "South Bend newsroom explicitly serves Michiana; listed counties are the reviewed Indiana/southwest Michigan coverage subset."
    }
  },
  {
    "id": "bizwest-com",
    "name": "BizWest",
    "websiteUrl": "https://bizwest.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "colorado/larimer",
      "colorado/weld"
    ],
    "countyFips": [
      "08069",
      "08123"
    ],
    "coverage": "regional",
    "coverageUrl": "https://bizwest.com/about-us/",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://bizwest.com/",
        "https://bizwest.com/about-us/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "businessobserverfl-com",
    "name": "Business Observer",
    "websiteUrl": "https://businessobserverfl.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "florida/pinellas",
      "florida/sarasota"
    ],
    "countyFips": [
      "12103",
      "12115"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.businessobserverfl.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.businessobserverfl.com/rss/headlines/all/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://businessobserverfl.com/",
        "https://www.businessobserverfl.com/contact-us/",
        "https://www.businessobserverfl.com/rss/headlines/all/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "cascadiadaily-com",
    "name": "Cascadia Daily News",
    "websiteUrl": "https://cascadiadaily.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "washington/skagit",
      "washington/whatcom"
    ],
    "countyFips": [
      "53057",
      "53073"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.cascadiadaily.com/contact/",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://cascadiadaily.com/",
        "https://www.cascadiadaily.com/contact/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "clintoncountydailynews-com",
    "name": "Clinton County Daily News",
    "websiteUrl": "https://clintoncountydailynews.com/",
    "outletTypes": [
      "digital",
      "radio"
    ],
    "counties": [
      "indiana/clinton"
    ],
    "countyFips": [
      "18023"
    ],
    "coverage": "regional",
    "coverageUrl": "https://clintoncountydailynews.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://clintoncountydailynews.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://clintoncountydailynews.com/",
        "https://clintoncountydailynews.com/contact-us/",
        "https://clintoncountydailynews.com/feed/"
      ],
      "basis": "Frankfort, Indiana newsroom/radio site covering Clinton County; exclude the Kentucky observation."
    }
  },
  {
    "id": "crawfordcountynow-com",
    "name": "Crawford County Now",
    "websiteUrl": "https://crawfordcountynow.com/",
    "outletTypes": [
      "digital",
      "radio"
    ],
    "counties": [
      "ohio/crawford"
    ],
    "countyFips": [
      "39033"
    ],
    "coverage": "regional",
    "coverageUrl": "https://crawfordcountynow.com/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://crawfordcountynow.com/sitemap.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://crawfordcountynow.com/",
        "https://crawfordcountynow.com/about-us/",
        "https://crawfordcountynow.com/sitemap.rss"
      ],
      "basis": "Publisher explicitly describes Bucyrus and Crawford County, Ohio reporting and its WQEL/WBCO radio services."
    }
  },
  {
    "id": "gbtribune-com",
    "name": "Great Bend Tribune",
    "websiteUrl": "https://gbtribune.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "kansas/barton",
      "kansas/pawnee"
    ],
    "countyFips": [
      "20009",
      "20145"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.gbtribune.com:443/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.gbtribune.com:443/rss/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://gbtribune.com/",
        "https://www.gbtribune.com:443/contact-us/",
        "https://www.gbtribune.com:443/rss/"
      ],
      "basis": "Publisher explicitly identifies Barton and Pawnee counties and their towns in its service-area description."
    }
  },
  {
    "id": "hudsonvalleyone-com",
    "name": "Hudson Valley One",
    "websiteUrl": "https://hudsonvalleyone.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "new-york/ulster"
    ],
    "countyFips": [
      "36111"
    ],
    "coverage": "regional",
    "coverageUrl": "https://hudsonvalleyone.com/contact/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://hudsonvalleyone.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://hudsonvalleyone.com/",
        "https://hudsonvalleyone.com/contact/",
        "https://hudsonvalleyone.com/feed/"
      ],
      "basis": "Ulster Publishing newsroom and its Kingston, New Paltz and Woodstock coverage support Ulster County. Dutchess observation held without equivalent evidence."
    }
  },
  {
    "id": "indyweek-com",
    "name": "Indy Week",
    "websiteUrl": "https://indyweek.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "north-carolina/wake",
      "north-carolina/durham",
      "north-carolina/orange"
    ],
    "countyFips": [
      "37183",
      "37063",
      "37135"
    ],
    "coverage": "regional",
    "coverageUrl": "https://indyweek.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://indyweek.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://indyweek.com/",
        "https://indyweek.com/feed/"
      ],
      "basis": "Publisher explicitly identifies Raleigh, Durham, Chapel Hill and the Triangle; mapped to Wake, Durham and Orange counties."
    }
  },
  {
    "id": "k105-com",
    "name": "K105",
    "websiteUrl": "https://k105.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "kentucky/grayson"
    ],
    "countyFips": [
      "21085"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.k105.com/about/",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://k105.com/",
        "https://www.k105.com/about/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "kbhbradio-com",
    "name": "KBHB Radio",
    "websiteUrl": "https://kbhbradio.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "south-dakota/meade"
    ],
    "countyFips": [
      "46093"
    ],
    "coverage": "regional",
    "coverageUrl": "https://kbhbradio.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://kbhbradio.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://kbhbradio.com/",
        "https://kbhbradio.com/about/",
        "https://kbhbradio.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "kgab-com",
    "name": "KGAB",
    "websiteUrl": "https://kgab.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "wyoming/laramie"
    ],
    "countyFips": [
      "56021"
    ],
    "coverage": "regional",
    "coverageUrl": "https://kgab.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://kgab.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://kgab.com/",
        "https://kgab.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "kiwaradio-com",
    "name": "KIWA Radio",
    "websiteUrl": "https://kiwaradio.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "iowa/sioux",
      "iowa/lyon",
      "iowa/osceola"
    ],
    "countyFips": [
      "19167",
      "19119",
      "19143"
    ],
    "coverage": "regional",
    "coverageUrl": "https://kiwaradio.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://kiwaradio.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://kiwaradio.com/",
        "https://kiwaradio.com/about/",
        "https://kiwaradio.com/feed/"
      ],
      "basis": "Publisher identifies Sioux County Daily, Lyon County Daily and Osceola County Daily as its local coverage partners."
    }
  },
  {
    "id": "kpax-com",
    "name": "KPAX News",
    "websiteUrl": "https://kpax.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "montana/lake",
      "montana/missoula",
      "montana/flathead",
      "montana/ravalli"
    ],
    "countyFips": [
      "30047",
      "30063",
      "30029",
      "30081"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.kpax.com/about/contact-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.kpax.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://kpax.com/",
        "https://www.kpax.com/about/contact-us",
        "https://www.kpax.com/index.rss"
      ],
      "basis": "Publisher has explicit Missoula, Flathead and Ravalli desks, plus current Polson reporting in Lake County, Montana."
    }
  },
  {
    "id": "kpbs-org",
    "name": "KPBS",
    "websiteUrl": "https://kpbs.org/",
    "outletTypes": [
      "television",
      "radio"
    ],
    "counties": [
      "california/san-diego",
      "california/imperial"
    ],
    "countyFips": [
      "06073",
      "06025"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.kpbs.org/about-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.kpbs.org/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://kpbs.org/",
        "https://www.kpbs.org/about-us",
        "https://www.kpbs.org/index.rss"
      ],
      "basis": "KPBS explicitly serves San Diego and Imperial counties through both public television and radio."
    }
  },
  {
    "id": "kscbnews-net",
    "name": "KSCB Radio News",
    "websiteUrl": "https://kscbnews.net/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "kansas/seward",
      "kansas/stevens"
    ],
    "countyFips": [
      "20175",
      "20189"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.kscbnews.net/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.kscbnews.net/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://kscbnews.net/",
        "https://www.kscbnews.net/contact-us/",
        "https://www.kscbnews.net/feed/"
      ],
      "basis": "Liberal, Kansas station serves southwest Kansas and the panhandles; only reviewed Seward and Stevens county relationships are listed."
    }
  },
  {
    "id": "ktvq-com",
    "name": "KTVQ",
    "websiteUrl": "https://ktvq.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "montana/yellowstone"
    ],
    "countyFips": [
      "30111"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.ktvq.com/about-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.ktvq.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://ktvq.com/",
        "https://www.ktvq.com/about-us",
        "https://www.ktvq.com/index.rss"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "longislandpress-com",
    "name": "Long Island Press",
    "websiteUrl": "https://longislandpress.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "new-york/nassau",
      "new-york/suffolk"
    ],
    "countyFips": [
      "36059",
      "36103"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.longislandpress.com/contact/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.longislandpress.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://longislandpress.com/",
        "https://www.longislandpress.com/contact/",
        "https://www.longislandpress.com/feed/"
      ],
      "basis": "Publisher explicitly identifies Nassau and Suffolk County readers."
    }
  },
  {
    "id": "nbcsandiego-com",
    "name": "NBC 7 San Diego",
    "websiteUrl": "https://nbcsandiego.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "california/san-diego"
    ],
    "countyFips": [
      "06073"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.nbcsandiego.com/news/local/about-us-nbc-7-san-diego/3030071/",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://nbcsandiego.com/",
        "https://www.nbcsandiego.com/news/local/about-us-nbc-7-san-diego/3030071/",
        "https://www.nbcsandiego.com/?rss=y"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "northfortynews-com",
    "name": "North Forty News",
    "websiteUrl": "https://northfortynews.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "colorado/larimer",
      "colorado/weld"
    ],
    "countyFips": [
      "08069",
      "08123"
    ],
    "coverage": "regional",
    "coverageUrl": "https://northfortynews.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://northfortynews.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://northfortynews.com/",
        "https://northfortynews.com/about/",
        "https://northfortynews.com/feed/"
      ],
      "basis": "Northern Colorado publisher lists reporting by area for Fort Collins, Loveland and Greeley; mapped to Larimer and Weld counties."
    }
  },
  {
    "id": "paloaltoonline-com",
    "name": "Palo Alto Online",
    "websiteUrl": "https://paloaltoonline.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "california/san-mateo",
      "california/santa-clara"
    ],
    "countyFips": [
      "06081",
      "06085"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.paloaltoonline.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.paloaltoonline.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://paloaltoonline.com/",
        "https://www.paloaltoonline.com/contact-us/",
        "https://www.paloaltoonline.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "pineandlakes-com",
    "name": "Pine and Lakes Echo Journal",
    "websiteUrl": "https://pineandlakes.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "minnesota/cass",
      "minnesota/crow-wing"
    ],
    "countyFips": [
      "27021",
      "27035"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.pineandlakes.com/contact-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.pineandlakes.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://pineandlakes.com/",
        "https://www.pineandlakes.com/contact-us",
        "https://www.pineandlakes.com/index.rss"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "postbulletin-com",
    "name": "Post-Bulletin",
    "websiteUrl": "https://postbulletin.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "minnesota/wabasha"
    ],
    "countyFips": [
      "27157"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.postbulletin.com/contact-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.postbulletin.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://postbulletin.com/",
        "https://www.postbulletin.com/contact-us",
        "https://www.postbulletin.com/business/post-bulletin-named-a-top-newspaper-in-minnesota-and-won-42-awards-too",
        "https://www.postbulletin.com/index.rss"
      ],
      "basis": "Southeast Minnesota newspaper with documented Wabasha County reporting; add Wabasha only and exclude the unrelated Iowa observation. Existing Rochester profile remains."
    }
  },
  {
    "id": "potomaclocal-com",
    "name": "Potomac Local News",
    "websiteUrl": "https://potomaclocal.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "virginia/stafford",
      "virginia/prince-william",
      "virginia/manassas",
      "virginia/manassas-park",
      "virginia/fredericksburg"
    ],
    "countyFips": [
      "51179",
      "51153",
      "51683",
      "51685",
      "51630"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.potomaclocal.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.potomaclocal.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://potomaclocal.com/",
        "https://www.potomaclocal.com/about/",
        "https://www.potomaclocal.com/feed/"
      ],
      "basis": "Publisher explicitly limits its local reporting to Prince William and Stafford counties and Manassas, Fredericksburg and Manassas Park cities."
    }
  },
  {
    "id": "sciotopost-com",
    "name": "Scioto Post",
    "websiteUrl": "https://sciotopost.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "ohio/pickaway",
      "ohio/ross"
    ],
    "countyFips": [
      "39129",
      "39141"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.sciotopost.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.sciotopost.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://sciotopost.com/",
        "https://www.sciotopost.com/about/",
        "https://www.sciotopost.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "siouxcountyradio-com",
    "name": "Sioux County Radio",
    "websiteUrl": "https://siouxcountyradio.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "iowa/sioux"
    ],
    "countyFips": [
      "19167"
    ],
    "coverage": "regional",
    "coverageUrl": "https://siouxcountyradio.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://siouxcountyradio.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://siouxcountyradio.com/",
        "https://siouxcountyradio.com/about/",
        "https://siouxcountyradio.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "heraldstaronline-com",
    "name": "The Herald Star",
    "websiteUrl": "https://heraldstaronline.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "ohio/jefferson",
      "west-virginia/hancock"
    ],
    "countyFips": [
      "39081",
      "54029"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.heraldstaronline.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.heraldstaronline.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://heraldstaronline.com/",
        "https://www.heraldstaronline.com/contact-us/",
        "https://www.heraldstaronline.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "houmatimes-com",
    "name": "The Times of Houma/Thibodaux",
    "websiteUrl": "https://houmatimes.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "louisiana/terrebonne",
      "louisiana/lafourche"
    ],
    "countyFips": [
      "22109",
      "22057"
    ],
    "coverage": "regional",
    "coverageUrl": "https://houmatimes.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://houmatimes.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://houmatimes.com/",
        "https://houmatimes.com/feed/"
      ],
      "basis": "Houma/Thibodaux masthead and current Terrebonne/Lafourche reporting support both Louisiana parishes."
    }
  },
  {
    "id": "theurbanist-org",
    "name": "The Urbanist",
    "websiteUrl": "https://theurbanist.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [
      "washington/king",
      "washington/snohomish"
    ],
    "countyFips": [
      "53033",
      "53061"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.theurbanist.org/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.theurbanist.org/rss/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://theurbanist.org/",
        "https://www.theurbanist.org/about-us/",
        "https://www.theurbanist.org/rss/"
      ],
      "basis": "Publisher describes Puget Sound advocacy journalism; reviewed King and Snohomish county coverage subset. Listing does not imply endorsement."
    }
  },
  {
    "id": "thevillagereporter-com",
    "name": "The Village Reporter",
    "websiteUrl": "https://thevillagereporter.com/",
    "outletTypes": [
      "newspaper"
    ],
    "counties": [
      "ohio/fulton",
      "ohio/williams"
    ],
    "countyFips": [
      "39051",
      "39171"
    ],
    "coverage": "regional",
    "coverageUrl": "https://thevillagereporter.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://thevillagereporter.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://thevillagereporter.com/",
        "https://thevillagereporter.com/wp-content/uploads/2026/01/2026-Rate-Card.pdf",
        "https://thevillagereporter.com/feed/"
      ],
      "basis": "Publisher masthead and 2026 rate card explicitly identify Fulton and Williams counties, Ohio."
    }
  },
  {
    "id": "wcjb-com",
    "name": "WCJB TV20",
    "websiteUrl": "https://wcjb.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "florida/alachua",
      "florida/marion",
      "florida/columbia"
    ],
    "countyFips": [
      "12001",
      "12083",
      "12023"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.wcjb.com:443/about-us/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.wcjb.com:443/arc/outboundfeeds/rss/?outputType=xml"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wcjb.com/",
        "https://www.wcjb.com:443/about-us/contact-us/",
        "https://www.wcjb.com:443/arc/outboundfeeds/rss/?outputType=xml"
      ],
      "basis": "Publisher explicitly covers Gainesville, Ocala and Lake City, mapped to Alachua, Marion and Columbia counties, Florida. Exclude the Georgia namesake."
    }
  },
  {
    "id": "wect-com",
    "name": "WECT TV6",
    "websiteUrl": "https://wect.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "north-carolina/brunswick",
      "north-carolina/new-hanover",
      "north-carolina/pender",
      "north-carolina/bladen",
      "north-carolina/columbus"
    ],
    "countyFips": [
      "37019",
      "37129",
      "37141",
      "37017",
      "37047"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.wect.com:443/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.wect.com:443/arc/outboundfeeds/rss/?outputType=xml"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wect.com/",
        "https://www.wect.com:443/about-us/",
        "https://www.wect.com:443/arc/outboundfeeds/rss/?outputType=xml"
      ],
      "basis": "Publisher explicitly identifies New Hanover, Brunswick, Pender, Bladen and Columbus counties in its service-area description."
    }
  },
  {
    "id": "whsv-com",
    "name": "WHSV",
    "websiteUrl": "https://whsv.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "virginia/rockingham",
      "virginia/harrisonburg",
      "virginia/staunton",
      "virginia/waynesboro"
    ],
    "countyFips": [
      "51165",
      "51660",
      "51790",
      "51820"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.whsv.com:443/about-us/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.whsv.com:443/arc/outboundfeeds/rss/?outputType=xml"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://whsv.com/",
        "https://www.whsv.com:443/about-us/contact-us/",
        "https://www.whsv.com:443/arc/outboundfeeds/rss/?outputType=xml"
      ],
      "basis": "Publisher explicitly names Harrisonburg, Staunton and Waynesboro and covers Rockingham County in the Shenandoah Valley."
    }
  },
  {
    "id": "wjon-com",
    "name": "WJON",
    "websiteUrl": "https://wjon.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "minnesota/stearns"
    ],
    "countyFips": [
      "27145"
    ],
    "coverage": "regional",
    "coverageUrl": "https://wjon.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://wjon.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wjon.com/",
        "https://wjon.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "wkbw-com",
    "name": "WKBW",
    "websiteUrl": "https://wkbw.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "new-york/erie"
    ],
    "countyFips": [
      "36029"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.wkbw.com/about-us",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.wkbw.com/index.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wkbw.com/",
        "https://www.wkbw.com/about-us",
        "https://www.wkbw.com/index.rss"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "wmdt-com",
    "name": "WMDT",
    "websiteUrl": "https://wmdt.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "maryland/somerset",
      "maryland/worcester"
    ],
    "countyFips": [
      "24039",
      "24047"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.wmdt.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wmdt.com/",
        "https://www.wmdt.com/contact-us/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "wnyt-com",
    "name": "WNYT NewsChannel 13",
    "websiteUrl": "https://wnyt.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "new-york/albany",
      "new-york/rensselaer",
      "new-york/schenectady",
      "new-york/saratoga"
    ],
    "countyFips": [
      "36001",
      "36083",
      "36093",
      "36091"
    ],
    "coverage": "regional",
    "coverageUrl": "https://wnyt.com/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://wnyt.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wnyt.com/",
        "https://wnyt.com/contact-us/",
        "https://wnyt.com/feed/"
      ],
      "basis": "Publisher explicitly names Albany, Troy, Schenectady and Saratoga Springs in its Capital Region service area."
    }
  },
  {
    "id": "wpgtalkradio-com",
    "name": "WPG Talk Radio 95.5 FM",
    "websiteUrl": "https://wpgtalkradio.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "new-jersey/atlantic"
    ],
    "countyFips": [
      "34001"
    ],
    "coverage": "regional",
    "coverageUrl": "https://wpgtalkradio.com/contact/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://wpgtalkradio.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wpgtalkradio.com/",
        "https://wpgtalkradio.com/contact/",
        "https://wpgtalkradio.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "wtap-com",
    "name": "WTAP",
    "websiteUrl": "https://wtap.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "west-virginia/wood",
      "ohio/washington"
    ],
    "countyFips": [
      "54107",
      "39167"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.wtap.com:443/about-us/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.wtap.com:443/arc/outboundfeeds/rss/?outputType=xml"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wtap.com/",
        "https://www.wtap.com:443/about-us/contact-us/",
        "https://www.wtap.com:443/arc/outboundfeeds/rss/?outputType=xml"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "wtop-news",
    "name": "WTOP News",
    "websiteUrl": "https://wtop.com/",
    "outletTypes": [
      "radio",
      "digital"
    ],
    "counties": [
      "district-of-columbia/district-of-columbia",
      "maryland/montgomery",
      "maryland/prince-george-s",
      "virginia/arlington",
      "virginia/fairfax",
      "virginia/fairfax-city",
      "virginia/alexandria"
    ],
    "countyFips": [
      "11001",
      "24031",
      "24033",
      "51013",
      "51059",
      "51600",
      "51510"
    ],
    "coverage": "regional",
    "coverageUrl": "https://wtop.com/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://wtop.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wtop.com/",
        "https://wtop.com/feed/"
      ],
      "basis": "Washington metropolitan radio newsroom; explicitly listed DC, Maryland and northern Virginia service-area counties only. Its national wire stories remain subject to county filtering."
    }
  },
  {
    "id": "wtvy-com",
    "name": "WTVY",
    "websiteUrl": "https://wtvy.com/",
    "outletTypes": [
      "television"
    ],
    "counties": [
      "alabama/henry",
      "alabama/houston"
    ],
    "countyFips": [
      "01067",
      "01069"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.wtvy.com:443/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.wtvy.com:443/arc/outboundfeeds/rss/?outputType=xml"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wtvy.com/",
        "https://www.wtvy.com:443/about-us/",
        "https://www.wtvy.com:443/arc/outboundfeeds/rss/?outputType=xml"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "wxhc-com",
    "name": "WXHC",
    "websiteUrl": "https://wxhc.com/",
    "outletTypes": [
      "radio"
    ],
    "counties": [
      "new-york/cortland"
    ],
    "countyFips": [
      "36023"
    ],
    "coverage": "regional",
    "coverageUrl": "https://www.wxhc.com/about-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.wxhc.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://wxhc.com/",
        "https://www.wxhc.com/about-us/",
        "https://www.wxhc.com/feed/"
      ],
      "basis": "Publisher masthead/service area and observed local reporting support the listed canonical counties; cities were resolved within their state. Directory approval does not grant county-tier trust."
    }
  },
  {
    "id": "alabamareflector-com",
    "name": "Alabama Reflector",
    "websiteUrl": "https://alabamareflector.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "alabama"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://alabamareflector.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://alabamareflector.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://alabamareflector.com/",
        "https://alabamareflector.com/about/",
        "https://alabamareflector.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "alaskabeacon-com",
    "name": "Alaska Beacon",
    "websiteUrl": "https://alaskabeacon.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "alaska"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://alaskabeacon.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://alaskabeacon.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://alaskabeacon.com",
        "https://alaskabeacon.com/about/",
        "https://alaskabeacon.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "azmirror-com",
    "name": "Arizona Mirror",
    "websiteUrl": "https://azmirror.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "arizona"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://azmirror.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://azmirror.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://azmirror.com",
        "https://azmirror.com/about/",
        "https://azmirror.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "arkansasadvocate-com",
    "name": "Arkansas Advocate",
    "websiteUrl": "https://arkansasadvocate.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "arkansas"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://arkansasadvocate.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://arkansasadvocate.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://arkansasadvocate.com/",
        "https://arkansasadvocate.com/about/",
        "https://arkansasadvocate.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "ctmirror-org",
    "name": "CT Mirror",
    "websiteUrl": "https://ctmirror.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "connecticut"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://ctmirror.org/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://ctmirror.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://ctmirror.org/",
        "https://ctmirror.org/contact-us/",
        "https://ctmirror.org/feed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "calmatters-org",
    "name": "CalMatters",
    "websiteUrl": "https://calmatters.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "california"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://calmatters.org/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://calmatters.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://calmatters.org/",
        "https://calmatters.org/about/",
        "https://calmatters.org/feed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "capitolnewsillinois-com",
    "name": "Capitol News Illinois",
    "websiteUrl": "https://capitolnewsillinois.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "illinois"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://capitolnewsillinois.com/about-us/",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://capitolnewsillinois.com/",
        "https://capitolnewsillinois.com/about-us/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "coloradonewsline-com",
    "name": "Colorado Newsline",
    "websiteUrl": "https://coloradonewsline.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "colorado"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://coloradonewsline.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://coloradonewsline.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://coloradonewsline.com",
        "https://coloradonewsline.com/about/",
        "https://coloradonewsline.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "commonwealthbeacon-org",
    "name": "Commonwealth Beacon",
    "websiteUrl": "https://commonwealthbeacon.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "massachusetts"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://commonwealthbeacon.org/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://commonwealthbeacon.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://commonwealthbeacon.org/",
        "https://commonwealthbeacon.org/about/",
        "https://commonwealthbeacon.org/feed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "dailymontanan-com",
    "name": "Daily Montanan",
    "websiteUrl": "https://dailymontanan.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "montana"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://dailymontanan.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://dailymontanan.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://dailymontanan.com",
        "https://dailymontanan.com/about/",
        "https://dailymontanan.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "floridaphoenix-com",
    "name": "Florida Phoenix",
    "websiteUrl": "https://floridaphoenix.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "florida"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://floridaphoenix.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://floridaphoenix.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://floridaphoenix.com",
        "https://floridaphoenix.com/about/",
        "https://floridaphoenix.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "georgiarecorder-com",
    "name": "Georgia Recorder",
    "websiteUrl": "https://georgiarecorder.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "georgia"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://georgiarecorder.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://georgiarecorder.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://georgiarecorder.com",
        "https://georgiarecorder.com/about/",
        "https://georgiarecorder.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "hawaii-public-radio",
    "name": "Hawaiʻi Public Radio",
    "websiteUrl": "https://www.hawaiipublicradio.org/",
    "outletTypes": [
      "radio"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "hawaii"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://www.hawaiipublicradio.org/about",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.hawaiipublicradio.org/local-news.rss"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://www.hawaiipublicradio.org/",
        "https://www.hawaiipublicradio.org/about",
        "https://www.hawaiipublicradio.org/local-news.rss"
      ],
      "basis": "Publisher describes two statewide radio streams. Supplement Civil Beat with a separate radio organization; use its local-news feed."
    }
  },
  {
    "id": "civilbeat-org",
    "name": "Honolulu Civil Beat",
    "websiteUrl": "https://www.civilbeat.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "hawaii"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://www.civilbeat.org/about",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.civilbeat.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://www.civilbeat.org/",
        "https://www.civilbeat.org/about",
        "https://www.civilbeat.org/feed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "idahocapitalsun-com",
    "name": "Idaho Capital Sun",
    "websiteUrl": "https://idahocapitalsun.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "idaho"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://idahocapitalsun.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://idahocapitalsun.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://idahocapitalsun.com",
        "https://idahocapitalsun.com/about/",
        "https://idahocapitalsun.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "indianacapitalchronicle-com",
    "name": "Indiana Capital Chronicle",
    "websiteUrl": "https://indianacapitalchronicle.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "indiana"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://indianacapitalchronicle.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://indianacapitalchronicle.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://indianacapitalchronicle.com/",
        "https://indianacapitalchronicle.com/about/",
        "https://indianacapitalchronicle.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "iowacapitaldispatch-com",
    "name": "Iowa Capital Dispatch",
    "websiteUrl": "https://iowacapitaldispatch.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "iowa"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://iowacapitaldispatch.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://iowacapitaldispatch.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://iowacapitaldispatch.com/",
        "https://iowacapitaldispatch.com/about/",
        "https://iowacapitaldispatch.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "kansasreflector-com",
    "name": "Kansas Reflector",
    "websiteUrl": "https://kansasreflector.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "kansas"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://kansasreflector.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://kansasreflector.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://kansasreflector.com/",
        "https://kansasreflector.com/about/",
        "https://kansasreflector.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "kentuckylantern-com",
    "name": "Kentucky Lantern",
    "websiteUrl": "https://kentuckylantern.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "kentucky"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://kentuckylantern.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://kentuckylantern.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://kentuckylantern.com/",
        "https://kentuckylantern.com/about/",
        "https://kentuckylantern.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "lailluminator-com",
    "name": "Louisiana Illuminator",
    "websiteUrl": "https://lailluminator.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "louisiana"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://lailluminator.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://lailluminator.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://lailluminator.com",
        "https://lailluminator.com/about/",
        "https://lailluminator.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "mainemorningstar-com",
    "name": "Maine Morning Star",
    "websiteUrl": "https://mainemorningstar.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "maine"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://mainemorningstar.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://mainemorningstar.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://mainemorningstar.com/",
        "https://mainemorningstar.com/about/",
        "https://mainemorningstar.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "marylandmatters-org",
    "name": "Maryland Matters",
    "websiteUrl": "https://www.marylandmatters.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "maryland"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://marylandmatters.org/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://marylandmatters.org/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://www.marylandmatters.org/",
        "https://marylandmatters.org/about/",
        "https://marylandmatters.org/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "michiganadvance-com",
    "name": "Michigan Advance",
    "websiteUrl": "https://michiganadvance.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "michigan"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://michiganadvance.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://michiganadvance.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://michiganadvance.com",
        "https://michiganadvance.com/about/",
        "https://michiganadvance.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "minnesotareformer-com",
    "name": "Minnesota Reformer",
    "websiteUrl": "https://minnesotareformer.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "minnesota"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://minnesotareformer.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://minnesotareformer.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://minnesotareformer.com",
        "https://minnesotareformer.com/about/",
        "https://minnesotareformer.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "mississippi-free-press",
    "name": "Mississippi Free Press",
    "websiteUrl": "https://www.mississippifreepress.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "mississippi"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://www.mississippifreepress.org/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://www.mississippifreepress.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://www.mississippifreepress.org/",
        "https://www.mississippifreepress.org/about/",
        "https://www.mississippifreepress.org/feed/"
      ],
      "basis": "Publisher describes statewide Mississippi reporting, including rural and underrepresented communities."
    }
  },
  {
    "id": "mississippitoday-org",
    "name": "Mississippi Today",
    "websiteUrl": "https://mississippitoday.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "mississippi"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://mississippitoday.org/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://mississippitoday.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://mississippitoday.org/",
        "https://mississippitoday.org/feed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "missouriindependent-com",
    "name": "Missouri Independent",
    "websiteUrl": "https://missouriindependent.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "missouri"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://missouriindependent.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://missouriindependent.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://missouriindependent.com",
        "https://missouriindependent.com/about/",
        "https://missouriindependent.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "ncnewsline-com",
    "name": "NC Newsline",
    "websiteUrl": "https://ncnewsline.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "north-carolina"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://ncnewsline.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://ncnewsline.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://ncnewsline.com/",
        "https://ncnewsline.com/about/",
        "https://ncnewsline.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "nebraskaexaminer-com",
    "name": "Nebraska Examiner",
    "websiteUrl": "https://nebraskaexaminer.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "nebraska"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://nebraskaexaminer.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://nebraskaexaminer.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://nebraskaexaminer.com",
        "https://nebraskaexaminer.com/about/",
        "https://nebraskaexaminer.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "nevadacurrent-com",
    "name": "Nevada Current",
    "websiteUrl": "https://nevadacurrent.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "nevada"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://nevadacurrent.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://nevadacurrent.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://nevadacurrent.com",
        "https://nevadacurrent.com/about/",
        "https://nevadacurrent.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "newhampshirebulletin-com",
    "name": "New Hampshire Bulletin",
    "websiteUrl": "https://newhampshirebulletin.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "new-hampshire"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://newhampshirebulletin.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://newhampshirebulletin.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://newhampshirebulletin.com",
        "https://newhampshirebulletin.com/about/",
        "https://newhampshirebulletin.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "newjerseymonitor-com",
    "name": "New Jersey Monitor",
    "websiteUrl": "https://newjerseymonitor.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "new-jersey"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://newjerseymonitor.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://newjerseymonitor.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://newjerseymonitor.com",
        "https://newjerseymonitor.com/about/",
        "https://newjerseymonitor.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "nysfocus-com",
    "name": "New York Focus",
    "websiteUrl": "https://nysfocus.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "new-york"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://nysfocus.com/about",
    "trustedForCountyTier": false,
    "feeds": [],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://nysfocus.com/",
        "https://nysfocus.com/about",
        "https://nysfocus.com/feed"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "northdakotamonitor-com",
    "name": "North Dakota Monitor",
    "websiteUrl": "https://www.northdakotamonitor.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "north-dakota"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://northdakotamonitor.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://northdakotamonitor.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://www.northdakotamonitor.com",
        "https://northdakotamonitor.com/about/",
        "https://northdakotamonitor.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "ohiocapitaljournal-com",
    "name": "Ohio Capital Journal",
    "websiteUrl": "https://ohiocapitaljournal.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "ohio"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://ohiocapitaljournal.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://ohiocapitaljournal.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://ohiocapitaljournal.com",
        "https://ohiocapitaljournal.com/about/",
        "https://ohiocapitaljournal.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "oklahomavoice-com",
    "name": "Oklahoma Voice",
    "websiteUrl": "https://oklahomavoice.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "oklahoma"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://oklahomavoice.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://oklahomavoice.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://oklahomavoice.com/",
        "https://oklahomavoice.com/about/",
        "https://oklahomavoice.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "oregoncapitalchronicle-com",
    "name": "Oregon Capital Chronicle",
    "websiteUrl": "https://oregoncapitalchronicle.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "oregon"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://oregoncapitalchronicle.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://oregoncapitalchronicle.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://oregoncapitalchronicle.com",
        "https://oregoncapitalchronicle.com/about/",
        "https://oregoncapitalchronicle.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "penncapital-star-com",
    "name": "Pennsylvania Capital-Star",
    "websiteUrl": "https://penncapital-star.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "pennsylvania"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://penncapital-star.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://penncapital-star.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://penncapital-star.com",
        "https://penncapital-star.com/about/",
        "https://penncapital-star.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "rhodeislandcurrent-com",
    "name": "Rhode Island Current",
    "websiteUrl": "https://rhodeislandcurrent.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "rhode-island"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://rhodeislandcurrent.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://rhodeislandcurrent.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://rhodeislandcurrent.com/",
        "https://rhodeislandcurrent.com/about/",
        "https://rhodeislandcurrent.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "sourcenm-com",
    "name": "Source New Mexico",
    "websiteUrl": "https://sourcenm.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "new-mexico"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://sourcenm.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://sourcenm.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://sourcenm.com/",
        "https://sourcenm.com/about/",
        "https://sourcenm.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "scdailygazette-com",
    "name": "South Carolina Daily Gazette",
    "websiteUrl": "https://scdailygazette.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "south-carolina"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://scdailygazette.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://scdailygazette.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://scdailygazette.com/",
        "https://scdailygazette.com/about/",
        "https://scdailygazette.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "southdakotasearchlight-com",
    "name": "South Dakota Searchlight",
    "websiteUrl": "https://southdakotasearchlight.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "south-dakota"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://southdakotasearchlight.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://southdakotasearchlight.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://southdakotasearchlight.com/",
        "https://southdakotasearchlight.com/about/",
        "https://southdakotasearchlight.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "spotlightdelaware-org",
    "name": "Spotlight Delaware",
    "websiteUrl": "https://spotlightdelaware.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "delaware"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://spotlightdelaware.org/contact-us/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://spotlightdelaware.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://spotlightdelaware.org/",
        "https://spotlightdelaware.org/contact-us/",
        "https://spotlightdelaware.org/feed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "tennesseelookout-com",
    "name": "Tennessee Lookout",
    "websiteUrl": "https://tennesseelookout.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "tennessee"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://tennesseelookout.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://tennesseelookout.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://tennesseelookout.com",
        "https://tennesseelookout.com/about/",
        "https://tennesseelookout.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "texastribune-org",
    "name": "The Texas Tribune",
    "websiteUrl": "https://www.texastribune.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "texas"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://www.texastribune.org/about/?footer",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://feeds.texastribune.org/feeds/main/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://www.texastribune.org/",
        "https://www.texastribune.org/about/?footer",
        "https://feeds.texastribune.org/feeds/main/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "utahnewsdispatch-com",
    "name": "Utah News Dispatch",
    "websiteUrl": "https://utahnewsdispatch.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "utah"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://utahnewsdispatch.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://utahnewsdispatch.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://utahnewsdispatch.com/",
        "https://utahnewsdispatch.com/about/",
        "https://utahnewsdispatch.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "vtdigger-org",
    "name": "VT Digger",
    "websiteUrl": "https://vtdigger.org/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "vermont"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://vtdigger.org/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://vtdigger.org/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://vtdigger.org/",
        "https://vtdigger.org/about/",
        "https://vtdigger.org/feed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "virginiamercury-com",
    "name": "Virginia Mercury",
    "websiteUrl": "https://virginiamercury.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "virginia"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://virginiamercury.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://virginiamercury.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://virginiamercury.com",
        "https://virginiamercury.com/about/",
        "https://virginiamercury.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "washingtonstatestandard-com",
    "name": "Washington State Standard",
    "websiteUrl": "https://washingtonstatestandard.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "washington"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://washingtonstatestandard.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://washingtonstatestandard.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://washingtonstatestandard.com/",
        "https://washingtonstatestandard.com/about/",
        "https://washingtonstatestandard.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "westvirginiawatch-com",
    "name": "West Virginia Watch",
    "websiteUrl": "https://westvirginiawatch.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "west-virginia"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://westvirginiawatch.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://westvirginiawatch.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://westvirginiawatch.com/",
        "https://westvirginiawatch.com/about/",
        "https://westvirginiawatch.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "wisconsinexaminer-com",
    "name": "Wisconsin Examiner",
    "websiteUrl": "https://wisconsinexaminer.com",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "wisconsin"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://wisconsinexaminer.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://wisconsinexaminer.com/feed/localFeed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://wisconsinexaminer.com",
        "https://wisconsinexaminer.com/about/",
        "https://wisconsinexaminer.com/feed/localFeed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  },
  {
    "id": "wyofile-com",
    "name": "WyoFile",
    "websiteUrl": "https://wyofile.com/",
    "outletTypes": [
      "digital"
    ],
    "counties": [],
    "countyFips": [],
    "states": [
      "wyoming"
    ],
    "coverage": "statewide",
    "coverageUrl": "https://wyofile.com/about/",
    "trustedForCountyTier": false,
    "feeds": [
      {
        "url": "https://wyofile.com/feed/"
      }
    ],
    "review": {
      "status": "approved",
      "reviewedAt": "2026-09-10",
      "evidenceUrls": [
        "https://statesnewsroom.com/newsrooms/",
        "https://wyofile.com/",
        "https://wyofile.com/about/",
        "https://wyofile.com/feed/"
      ],
      "basis": "State-focused newsroom identified by the States Newsroom network directory and verified on the publisher website. Listed as a statewide supplement, not as a county-based newsroom."
    }
  }
];
