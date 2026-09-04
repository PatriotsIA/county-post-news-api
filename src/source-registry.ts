import { discoveredCountyNativeSources, discoveredRegionalSources } from "./county-discovered-sources.js";
import type { CountySite, FeedScope, NewsFeedItem, StateSite, Topic } from "./types.js";

export type DirectSource = {
  name: string;
  url: string;
  mediaType: NonNullable<NewsFeedItem["mediaType"]>;
  itemSource?: string;
  topics?: Topic[];
  states?: string[];
  markets?: string[];
  counties?: string[];
  maxAgeDays?: number;
  maxItems?: number;
  trustedForMarketTier?: boolean;
  /**
   * Whether an item from this source counts as county-local purely because it
   * came from here. True for an outlet that only covers this county; false for
   * a regional newsroom listed against a county so its feed is fetched, whose
   * stories must still name the county or one of its towns to appear. Without
   * the distinction, adding KLTV to the twenty East Texas counties it serves
   * would put all of East Texas on each of their desks.
   */
  trustedForCountyTier?: boolean;
};

export type CountyNativeFeed = {
  name?: string;
  url: string;
  topics?: Topic[];
  maxAgeDays?: number;
  maxItems?: number;
};

export type CountyNativeSource = {
  name: string;
  websiteUrl: string;
  feeds?: CountyNativeFeed[];
  outletTypes: Array<"newspaper" | "radio" | "television" | "digital">;
  aliases?: string[];
  topics?: Topic[];
  counties: string[];
  /**
   * Reviewed is not the same as trusted. A reviewed outlet is listed on its
   * counties' Local Sources pages and its feeds are fetched — but only a
   * trusted one (the default) puts every story it publishes on the desk
   * without naming the county. Set false for real local newsrooms whose feeds
   * mix in syndicated national wire (Gray/TEGNA/CNHI station feeds carry
   * network stories): their items still pass the text locality rules, so the
   * local coverage lands and the wire never does.
   */
  trustedForCountyTier?: boolean;
};

/**
 * Reviewed county-native outlets. A profile can be used for targeted search
 * even when the publisher does not expose a usable RSS or Atom feed.
 */
const countyNativeSources: CountyNativeSource[] = [
  {
    name: "The Mena Star",
    websiteUrl: "https://www.menastar.com/",
    outletTypes: ["newspaper"],
    aliases: ["Mena Star", "MenaStar.com"],
    counties: ["arkansas/polk"],
  },
  {
    name: "My Pulse News / KENA",
    websiteUrl: "https://mypulsenews.com/",
    feeds: [
      {
        url: "https://mypulsenews.com/feed/",
        topics: ["general", "crime"],
      },
      {
        name: "My Pulse News / KENA page 2",
        url: "https://mypulsenews.com/feed/?paged=2",
        topics: ["general", "crime"],
      },
      {
        name: "My Pulse News / KENA page 3",
        url: "https://mypulsenews.com/feed/?paged=3",
        topics: ["general", "crime"],
      },
      {
        name: "My Pulse News / KENA page 4",
        url: "https://mypulsenews.com/feed/?paged=4",
        topics: ["general", "crime"],
      },
      {
        name: "My Pulse News / KENA local news",
        url: "https://mypulsenews.com/category/news/feed/",
        topics: ["general", "politics", "economy", "crime"],
      },
      {
        name: "My Pulse News / KENA sports archive",
        url: "https://mypulsenews.com/category/sports/feed/",
        topics: ["sports"],
        maxAgeDays: 1_095,
        maxItems: 8,
      },
    ],
    outletTypes: ["digital", "radio"],
    aliases: ["My Pulse News", "MyPulseNews.com", "KENA", "KENA Radio", "KENA 104.1 FM"],
    counties: ["arkansas/polk"],
  },

  // Texas outlets promoted from the discovery review queue. Each was checked
  // against the county it covers before being trusted here: Athens is the
  // Henderson County seat, Gilmer the Upshur County seat, and so on. Trust
  // means every story these publish reaches that county's desk without having
  // to name it, which is what a county paper's own coverage deserves and what
  // a regional wire must never get.
  {
    // No usable RSS, but the profile still earns its place: it produces a
    // targeted site: search and lets the filter trust what that search returns.
    // This is how the Lufkin Daily News became Angelina County's top source.
    name: "The Lufkin Daily News",
    websiteUrl: "https://lufkindailynews.com/",
    outletTypes: ["newspaper"],
    aliases: ["Lufkin Daily News", "lufkindailynews.com"],
    counties: ["texas/angelina"],
  },
  {
    name: "Amarillo Globe-News",
    websiteUrl: "https://www.amarillo.com/",
    outletTypes: ["newspaper"],
    aliases: ["Amarillo Globe News", "amarillo.com"],
    // Amarillo straddles both counties, so its newsroom is native to each.
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "The Athens Review",
    websiteUrl: "https://athensreview.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/henderson"],
    feeds: [
      { url: "http://www.athensreview.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "Bluebonnet News",
    websiteUrl: "https://bluebonnetnews.com/",
    outletTypes: ["digital"],
    counties: ["texas/liberty"],
    feeds: [
      { url: "https://bluebonnetnews.com/feed/" },
      { url: "https://bluebonnetnews.com/comments/feed/" },
    ],
  },
  {
    name: "Cross Timbers Gazette",
    websiteUrl: "https://crosstimbersgazette.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/denton"],
    feeds: [
      { url: "https://www.crosstimbersgazette.com/feed/" },
      { url: "https://crosstimbersgazette.com/feed/" },
    ],
  },
  {
    name: "Denton Record-Chronicle",
    websiteUrl: "https://dentonrc.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/denton"],
    feeds: [
      { url: "http://dentonrc.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "Eagle Pass Business Journal",
    websiteUrl: "https://epbusinessjournal.com/",
    outletTypes: ["digital"],
    counties: ["texas/maverick"],
    feeds: [
      { url: "https://epbusinessjournal.com/feed/" },
      { url: "https://epbusinessjournal.com/rss" },
    ],
  },
  {
    name: "The Galveston County Daily News",
    websiteUrl: "https://galvnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/galveston"],
    feeds: [
      { url: "http://www.galvnews.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "The Gilmer Mirror",
    websiteUrl: "https://gilmermirror.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/upshur"],
    feeds: [
      { url: "https://www.gilmermirror.com/feed/" },
      { url: "https://www.gilmermirror.com/comments/feed/" },
    ],
  },
  {
    name: "The Herald-Banner",
    websiteUrl: "https://heraldbanner.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/hunt"],
    feeds: [
      { url: "http://www.heraldbanner.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "The Huntsville Item",
    websiteUrl: "https://itemonline.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/walker"],
    feeds: [
      { url: "http://www.itemonline.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "KAGS",
    websiteUrl: "https://kagstv.com/",
    outletTypes: ["television"],
    counties: ["texas/brazos"],
    feeds: [
      { url: "https://www.kagstv.com/feeds/syndication/rss/news" },
    ],
  },
  {
    name: "Levelland & Hockley County News Press",
    websiteUrl: "https://levellandnews.net/",
    outletTypes: ["newspaper"],
    counties: ["texas/hockley"],
    feeds: [
      { url: "https://levellandnews.net/rss.xml" },
    ],
  },
  {
    name: "News Channel 6",
    websiteUrl: "https://newschannel6now.com/",
    outletTypes: ["television"],
    counties: ["texas/wichita"],
    feeds: [
      { url: "https://newschannel6now.com/arc/outboundfeeds/rss/?outputType=xml" },
    ],
  },
  {
    name: "The Paris News",
    websiteUrl: "https://theparisnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/lamar"],
    feeds: [
      { url: "http://theparisnews.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "Royse City Herald-Banner",
    websiteUrl: "https://roysecityheraldbanner.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/rockwall"],
    feeds: [
      { url: "http://www.roysecityheraldbanner.com/search/?f=rss&t=article&l=50&s=start_time&sd=desc&k%5B%5D=%23topstory" },
    ],
  },
  {
    name: "San Antonio Report",
    websiteUrl: "https://sanantonioreport.org/",
    outletTypes: ["digital"],
    counties: ["texas/bexar"],
    feeds: [
      { url: "https://sanantonioreport.org/feed/" },
      { url: "https://sanantonioreport.org/rss" },
    ],
  },
  {
    name: "Seguin Today",
    websiteUrl: "https://seguintoday.com/",
    outletTypes: ["digital"],
    counties: ["texas/guadalupe"],
    feeds: [
      { url: "https://seguintoday.com/feed/" },
      { url: "https://seguintoday.com/rss" },
    ],
  },
  {
    name: "Texoma's Homepage",
    websiteUrl: "https://texomashomepage.com/",
    outletTypes: ["television"],
    counties: ["texas/wichita", "texas/archer"],
    feeds: [
      { url: "https://www.texomashomepage.com/feed/" },
      { url: "https://www.texomashomepage.com/comments/feed/" },
    ],
  },
  {
    name: "The University Star",
    websiteUrl: "https://universitystar.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/hays"],
    feeds: [
      { url: "https://universitystar.com/feed/" },
      { url: "https://universitystar.com/feed/atom/" },
    ],
  },
  {
    name: "NewsChannel 10",
    websiteUrl: "https://newschannel10.com/",
    outletTypes: ["television"],
    counties: ["texas/potter", "texas/randall"],
    feeds: [
      { url: "https://www.newschannel10.com/arc/outboundfeeds/rss/?outputType=xml" },
    ],
  },

  // === Texas comprehensive pass, September 2026 ===
  // Every entry below was probed live and its feed items (or homepage
  // headlines, for feedless profiles) read before inclusion. Entries with
  // trustedForCountyTier: false are real local newsrooms whose feeds mix in
  // syndicated national wire (Gray/TEGNA/Scripps/CNHI networks) or whose
  // hostname serves several counties' papers at once — fetched and listed,
  // but their stories still pass the text locality rules. Rejected outright,
  // do not re-add without fresh verification: bigspringherald.com,
  // borgernewsherald.com, kingsvillerecord.com, sweetwaterreporter.com
  // (identical PR-wire spam), snyderdailynews.com (foreign SEO spam),
  // spearmanreporter.com (SEO spam), bowienewsonline lifestyle syndication is
  // why it sits untrusted, hudspethcountyherald.com (domain now gambling
  // spam), stratfordstar/vegaenterprise/edenecho (parked or hijacked),
  // Austin Monitor (publication ended November 2025), wacotrib feed (dead
  // since 2023).
  {
    name: "EverythingLubbock (KLBK/KAMC)",
    websiteUrl: "https://www.everythinglubbock.com/",
    outletTypes: ["television"],
    counties: ["texas/lubbock"],
    feeds: [{ url: "https://www.everythinglubbock.com/feed/" }],
  },
  {
    name: "Yourbasin (KMID/KPEJ)",
    websiteUrl: "https://www.yourbasin.com/",
    outletTypes: ["television"],
    counties: ["texas/ector", "texas/midland"],
    feeds: [{ url: "https://www.yourbasin.com/feed/" }],
  },
  {
    name: "ConchoValleyHomepage (KLST/KSAN)",
    websiteUrl: "https://www.conchovalleyhomepage.com/",
    outletTypes: ["television"],
    counties: ["texas/tom-green"],
    feeds: [{ url: "https://www.conchovalleyhomepage.com/feed/" }],
  },
  {
    name: "BigCountryHomepage (KTAB/KRBC)",
    websiteUrl: "https://www.bigcountryhomepage.com/",
    outletTypes: ["television"],
    counties: ["texas/taylor", "texas/jones"],
    feeds: [{ url: "https://www.bigcountryhomepage.com/feed/" }],
  },
  {
    name: "KTXS 12",
    websiteUrl: "https://ktxs.com/",
    outletTypes: ["television"],
    counties: ["texas/taylor"],
    feeds: [{ url: "https://ktxs.com/news.rss" }],
  },
  {
    name: "Fort Worth Report",
    websiteUrl: "https://fortworthreport.org/",
    outletTypes: ["digital"],
    counties: ["texas/tarrant"],
    feeds: [{ url: "https://fortworthreport.org/feed/" }],
  },
  {
    name: "Houston Public Media",
    websiteUrl: "https://www.houstonpublicmedia.org/",
    outletTypes: ["digital", "radio"],
    counties: ["texas/harris"],
    feeds: [{ url: "https://www.houstonpublicmedia.org/rsslatest.xml" }],
  },
  {
    name: "KERA News",
    websiteUrl: "https://www.keranews.org/",
    outletTypes: ["digital", "radio"],
    counties: ["texas/dallas"],
    feeds: [{ url: "https://www.keranews.org/news.rss" }],
  },
  {
    name: "KUT News",
    websiteUrl: "https://www.kut.org/",
    outletTypes: ["digital", "radio"],
    counties: ["texas/travis"],
    feeds: [{ url: "https://www.kut.org/feeds/syndication/rss/news" }],
  },
  {
    name: "El Paso Matters",
    websiteUrl: "https://elpasomatters.org/",
    outletTypes: ["digital"],
    counties: ["texas/el-paso"],
    feeds: [{ url: "https://elpasomatters.org/feed/" }],
  },
  {
    name: "Tyler Morning Telegraph",
    websiteUrl: "https://tylerpaper.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/smith"],
    feeds: [{ url: "https://tylerpaper.com/feed/" }],
  },
  {
    name: "Longview News-Journal",
    websiteUrl: "https://news-journal.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/gregg"],
    feeds: [{ url: "https://news-journal.com/feed/" }],
  },
  {
    name: "Marshall News Messenger",
    websiteUrl: "https://marshallnewsmessenger.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/harrison"],
    feeds: [{ url: "https://marshallnewsmessenger.com/feed/" }],
  },
  {
    name: "Panola Watchman",
    websiteUrl: "https://panolawatchman.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/panola"],
    feeds: [{ url: "https://panolawatchman.com/feed/" }],
  },
  {
    name: "MyRGV",
    websiteUrl: "https://myrgv.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/cameron", "texas/hidalgo"],
    feeds: [{ url: "https://myrgv.com/feed/" }],
  },
  {
    name: "KRIS 6 News",
    websiteUrl: "https://www.kristv.com/",
    outletTypes: ["television"],
    counties: ["texas/nueces"],
    feeds: [{ url: "https://www.kristv.com/index.rss" }],
  },
  {
    name: "Herald Democrat",
    websiteUrl: "https://www.heralddemocrat.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/grayson"],
    feeds: [{ url: "https://www.heralddemocrat.com/feed/" }],
  },
  {
    name: "TXK Today",
    websiteUrl: "https://txktoday.com/",
    outletTypes: ["digital"],
    counties: ["texas/bowie"],
    feeds: [{ url: "https://txktoday.com/feed/" }],
  },
  {
    name: "Port Arthur News",
    websiteUrl: "https://www.panews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/jefferson"],
    feeds: [{ url: "https://www.panews.com/feed/" }],
  },
  {
    name: "The Orange Leader",
    websiteUrl: "https://www.orangeleader.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/orange"],
    feeds: [{ url: "https://www.orangeleader.com/feed/" }],
  },
  {
    name: "KSST Radio",
    websiteUrl: "https://www.ksstradio.com/",
    outletTypes: ["radio", "digital"],
    counties: ["texas/hopkins"],
    feeds: [{ url: "https://www.ksstradio.com/feed/" }],
  },
  {
    name: "Victoria Advocate",
    websiteUrl: "https://www.victoriaadvocate.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/victoria"],
    feeds: [{ url: "https://www.victoriaadvocate.com/feed/" }],
  },
  {
    name: "The Kerr County Lead",
    websiteUrl: "https://kerrcountylead.com/",
    outletTypes: ["digital"],
    counties: ["texas/kerr"],
    feeds: [{ url: "https://kerrcountylead.com/feed/" }],
  },
  {
    name: "Kerrville Daily Times",
    websiteUrl: "https://www.dailytimes.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/kerr"],
    feeds: [{ url: "https://www.dailytimes.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
  },
  {
    name: "New Braunfels Herald-Zeitung",
    websiteUrl: "https://herald-zeitung.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/comal"],
    feeds: [{ url: "https://herald-zeitung.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
  },
  {
    name: "Fort Bend Herald",
    websiteUrl: "https://www.fbherald.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/fort-bend"],
    feeds: [{ url: "https://www.fbherald.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
  },
  {
    name: "Wise County Messenger",
    websiteUrl: "https://www.wcmessenger.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/wise"],
    feeds: [{ url: "https://www.wcmessenger.com/feed/" }],
  },
  {
    name: "Mineral Wells Index",
    websiteUrl: "https://www.mineralwellsindex.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/palo-pinto"],
    feeds: [{ url: "http://www.weatherforddemocrat.com/search/?f=rss&t=article&c=mineral-wells&l=50&s=start_time&sd=desc" }],
  },
  {
    name: "Waxahachie Daily Light",
    websiteUrl: "https://www.waxahachietx.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/ellis"],
    feeds: [{ url: "https://www.waxahachietx.com/feed/" }],
  },
  {
    name: "Uvalde Leader-News",
    websiteUrl: "https://www.uvaldeleadernews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/uvalde"],
    feeds: [{ url: "https://www.uvaldeleadernews.com/feed/" }],
  },
  {
    name: "Hondo Anvil Herald",
    websiteUrl: "https://www.hondoanvilherald.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/medina"],
    feeds: [{ url: "https://www.hondoanvilherald.com/blog-feed.xml" }],
  },
  {
    name: "Pleasanton Express",
    websiteUrl: "https://www.pleasantonexpress.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/atascosa"],
    feeds: [{ url: "https://www.pleasantonexpress.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
  },
  {
    name: "Fayette County Record",
    websiteUrl: "https://www.fayettecountyrecord.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/fayette"],
    feeds: [{ url: "https://www.fayettecountyrecord.com/rss.xml" }],
  },
  {
    name: "Brenham Banner-Press",
    websiteUrl: "https://www.brenhambanner.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/washington"],
    feeds: [{ url: "http://www.southtexasnews.com/search/?f=rss&t=article&c=brenham_banner_press&l=50&s=start_time&sd=desc" }],
  },
  {
    name: "Madisonville Meteor",
    websiteUrl: "https://www.madisonvillemeteor.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/madison"],
    feeds: [{ url: "https://www.madisonvillemeteor.com/rss/articles" }],
  },
  {
    name: "Navasota Examiner",
    websiteUrl: "https://www.navasotaexaminer.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/grimes"],
    feeds: [{ url: "https://www.navasotaexaminer.com/rss/articles" }],
  },
  {
    name: "Light and Champion",
    websiteUrl: "https://www.lightandchampion.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/shelby"],
    feeds: [{ url: "https://www.lightandchampion.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
  },
  {
    name: "Gatesville Messenger",
    websiteUrl: "https://www.gatesvillemessenger.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/coryell"],
    feeds: [{ url: "https://www.gatesvillemessenger.com/rss.xml" }],
  },
  {
    name: "Lampasas Dispatch Record",
    websiteUrl: "https://www.lampasasdispatchrecord.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/lampasas"],
    feeds: [{ url: "https://www.lampasasdispatchrecord.com/rss.xml" }],
  },
  {
    name: "Rockdale Reporter",
    websiteUrl: "https://www.rockdalereporter.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/milam"],
    feeds: [{ url: "https://www.rockdalereporter.com/rss.xml" }],
  },
  {
    name: "Wilson County News",
    websiteUrl: "https://www.wilsoncountynews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/wilson"],
    feeds: [{ url: "https://www.wilsoncountynews.com/feed/" }],
  },
  {
    name: "Clifton Record",
    websiteUrl: "https://www.cliftonrecord.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/bosque"],
    feeds: [{ url: "https://cliftonrecordtribune.com/feed/" }],
  },
  {
    name: "Elgin Courier",
    websiteUrl: "https://www.elgincourier.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/bastrop"],
    feeds: [{ url: "https://www.elgincourier.com/rss/articles" }],
  },
  {
    name: "Boerne Star",
    websiteUrl: "https://www.boernestar.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/kendall"],
    feeds: [{ url: "https://www.boernestar.com/rss/articles" }],
  },
  {
    name: "Fredericksburg Standard-Radio Post",
    websiteUrl: "https://www.fredericksburgstandard.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/gillespie"],
    feeds: [{ url: "https://www.fredericksburgstandard.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
  },
  {
    name: "The Big Bend Sentinel",
    websiteUrl: "https://bigbendsentinel.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/presidio"],
    feeds: [{ url: "https://bigbendsentinel.com/feed/" }],
  },
  {
    name: "Alpine Avalanche",
    websiteUrl: "https://www.alpineavalanche.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/brewster"],
    feeds: [{ url: "https://www.alpineavalanche.com/rss.xml" }],
  },
  {
    name: "The Albany News",
    websiteUrl: "https://www.thealbanynews.net/",
    outletTypes: ["newspaper"],
    counties: ["texas/shackelford"],
    feeds: [{ url: "https://www.thealbanynews.net/rss.xml" }],
  },
  {
    name: "Breckenridge American",
    websiteUrl: "https://www.breckenridgeamerican.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/stephens"],
    feeds: [{ url: "http://www.grahamleader.com/search/?f=rss&t=article&c=breckenridge-american&l=50&s=start_time&sd=desc" }],
  },
  {
    name: "The Graham Leader",
    websiteUrl: "https://www.grahamleader.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/young"],
    feeds: [{ url: "https://www.grahamleader.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
  },
  {
    name: "San Saba News & Star",
    websiteUrl: "https://www.sansabanews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/san-saba"],
    feeds: [{ url: "https://www.sansabanews.com/rss.xml" }],
  },
  {
    name: "Goldthwaite Eagle",
    websiteUrl: "https://www.goldthwaiteeagle.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/mills"],
    feeds: [{ url: "https://www.goldthwaiteeagle.com/feed/" }],
  },
  {
    name: "Colorado County Citizen",
    websiteUrl: "https://www.coloradocountycitizen.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/colorado"],
    feeds: [{ url: "https://www.coloradocountycitizen.com/rss/articles" }],
  },
  {
    name: "Perryton Herald",
    websiteUrl: "https://www.perrytonherald.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/ochiltree"],
    feeds: [{ url: "https://www.perrytonherald.com/rss.xml" }],
  },
  {
    name: "Floyd County Hesperian-Beacon",
    websiteUrl: "https://www.hesperianbeacononline.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/floyd"],
    feeds: [{ url: "https://www.hesperianbeacononline.com/rss.xml" }],
  },
  {
    name: "Lamb County Leader-News",
    websiteUrl: "https://www.lambcountyleadernews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/lamb"],
    feeds: [{ url: "https://www.lambcountyleadernews.com/rss.xml" }],
  },
  {
    name: "Lamesa Press-Reporter",
    websiteUrl: "https://www.pressreporter.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/dawson"],
    feeds: [{ url: "https://www.pressreporter.com/rss.xml" }],
  },
  {
    name: "Knox County News-Courier",
    websiteUrl: "https://www.knoxcountynewsonline.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/knox"],
    feeds: [{ url: "https://www.knoxcountynewsonline.com/rss.xml" }],
  },
  {
    name: "Eastland County Today",
    websiteUrl: "https://www.eastlandcountytoday.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/eastland"],
    feeds: [{ url: "https://www.eastlandcountytoday.com/rss/articles" }],
  },
  {
    name: "Coleman Today",
    websiteUrl: "https://www.colemantoday.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/coleman"],
    feeds: [{ url: "https://www.colemantoday.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
  },
  {
    name: "Clay County Leader",
    websiteUrl: "https://www.claycountyleader.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/clay"],
    feeds: [{ url: "https://www.claycountyleader.com/feed/" }],
  },
  {
    name: "Vernon Daily Record",
    websiteUrl: "https://www.vernonrecord.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/wilbarger"],
    feeds: [{ url: "https://www.vernonrecord.com/feed/" }],
  },
  {
    name: "Fort Stockton Pioneer",
    websiteUrl: "https://www.fortstocktonpioneer.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/pecos"],
    feeds: [{ url: "https://www.fortstocktonpioneer.com/rss.xml" }],
  },
  {
    name: "Bay City Sentinel",
    websiteUrl: "https://www.baycitysentinel.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/matagorda"],
    feeds: [{ url: "https://www.baycitysentinel.com/rss.xml" }],
  },
  {
    name: "The Sealy News",
    websiteUrl: "https://www.sealynews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/austin"],
    feeds: [{ url: "https://www.sealynews.com/rss/articles" }],
  },
  {
    name: "Bandera Bulletin",
    websiteUrl: "https://www.banderabulletin.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/bandera"],
    feeds: [{ url: "https://www.banderabulletin.com/rss/articles" }],
  },
  {
    name: "The Flash Today",
    websiteUrl: "https://www.theflashtoday.com/",
    outletTypes: ["digital"],
    counties: ["texas/erath"],
    feeds: [{ url: "https://theflashtoday.com/feed/" }],
  },
  {
    name: "Glen Rose Reporter",
    websiteUrl: "https://www.yourglenrosetx.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/somervell"],
    feeds: [{ url: "https://www.yourglenrosetx.com/feed/" }],
  },
  {
    name: "Menard News & Messenger",
    websiteUrl: "https://www.menardnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/menard"],
    feeds: [{ url: "https://www.menardnews.com/rss.xml" }],
  },
  {
    name: "Van Zandt News",
    websiteUrl: "https://www.vanzandtnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/van-zandt"],
    feeds: [{ url: "https://www.vanzandtnews.com/rss.xml" }],
  },
  {
    name: "Kaufman Herald",
    websiteUrl: "https://www.kaufmanherald.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/kaufman"],
    feeds: [{ url: "https://www.kaufmanherald.com/rss.xml" }],
  },
  {
    name: "eParisExtra",
    websiteUrl: "https://eparisextra.com/",
    outletTypes: ["digital"],
    counties: ["texas/lamar"],
    feeds: [{ url: "https://eextra.news/paris/feed/" }],
  },
  {
    name: "Runnels County Register",
    websiteUrl: "https://www.runnelscountyregister.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/runnels"],
    feeds: [{ url: "https://www.runnelscountyregister.com/feed/" }],
  },
  {
    name: "Hays Free Press",
    websiteUrl: "https://haysfreepress.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/hays"],
    feeds: [{ url: "https://www.haysfreepress.com/rss/articles" }],
  },
  {
    name: "Lockhart Post-Register",
    websiteUrl: "https://www.post-register.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/caldwell"],
    feeds: [{ url: "https://post-register.com/feed/" }],
  },
  {
    name: "25 News KXXV",
    websiteUrl: "https://www.kxxv.com/",
    outletTypes: ["television"],
    counties: ["texas/mclennan"],
    feeds: [{ url: "https://www.kxxv.com/index.rss" }],
    trustedForCountyTier: false,
  },
  {
    name: "KWTX News 10",
    websiteUrl: "https://www.kwtx.com/",
    outletTypes: ["television"],
    counties: ["texas/mclennan"],
    feeds: [{ url: "https://www.kwtx.com/arc/outboundfeeds/rss/?outputType=xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "ValleyCentral (KVEO)",
    websiteUrl: "https://www.valleycentral.com/",
    outletTypes: ["television"],
    counties: ["texas/cameron"],
    feeds: [{ url: "https://www.valleycentral.com/feed/" }],
    trustedForCountyTier: false,
  },
  {
    name: "KTSM 9 News",
    websiteUrl: "https://www.ktsm.com/",
    outletTypes: ["television"],
    counties: ["texas/el-paso"],
    feeds: [{ url: "https://www.ktsm.com/feed/" }],
    trustedForCountyTier: false,
  },
  {
    name: "KGNS News",
    websiteUrl: "https://www.kgns.tv/",
    outletTypes: ["television"],
    counties: ["texas/webb"],
    feeds: [{ url: "https://www.kgns.tv/arc/outboundfeeds/rss/?outputType=xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "KXII News 12",
    websiteUrl: "https://www.kxii.com/",
    outletTypes: ["television"],
    counties: ["texas/grayson"],
    feeds: [{ url: "https://www.kxii.com/arc/outboundfeeds/rss/?outputType=xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "KIII 3News",
    websiteUrl: "https://www.kiiitv.com/",
    outletTypes: ["television"],
    counties: ["texas/nueces"],
    feeds: [{ url: "https://www.kiiitv.com/feeds/syndication/rss/news" }],
    trustedForCountyTier: false,
  },
  {
    name: "NewsWest 9",
    websiteUrl: "https://www.newswest9.com/",
    outletTypes: ["television"],
    counties: ["texas/midland"],
    feeds: [{ url: "https://www.newswest9.com/feeds/syndication/rss/news" }],
    trustedForCountyTier: false,
  },
  {
    name: "CBS7 Odessa",
    websiteUrl: "https://www.cbs7.com/",
    outletTypes: ["television"],
    counties: ["texas/ector"],
    feeds: [{ url: "https://www.cbs7.com/arc/outboundfeeds/rss/?outputType=xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "12NewsNow (KBMT)",
    websiteUrl: "https://www.12newsnow.com/",
    outletTypes: ["television"],
    counties: ["texas/jefferson"],
    feeds: [{ url: "https://www.12newsnow.com/feeds/syndication/rss/news" }],
    trustedForCountyTier: false,
  },
  {
    name: "Odessa American",
    websiteUrl: "https://www.oaoa.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/ector"],
    feeds: [{ url: "https://www.oaoa.com/feed/" }],
    trustedForCountyTier: false,
  },
  {
    name: "Crossroads Today",
    websiteUrl: "https://www.crossroadstoday.com/",
    outletTypes: ["television"],
    counties: ["texas/victoria"],
    feeds: [{ url: "https://www.crossroadstoday.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "The Daily Sentinel",
    websiteUrl: "https://dailysentinel.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/nacogdoches"],
    feeds: [{ url: "https://dailysentinel.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "The Facts",
    websiteUrl: "https://www.thefacts.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/brazoria"],
    feeds: [{ url: "https://www.thefacts.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Killeen Daily Herald",
    websiteUrl: "https://kdhnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/bell"],
    feeds: [{ url: "https://kdhnews.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Temple Daily Telegram",
    websiteUrl: "https://www.tdtnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/bell"],
    feeds: [{ url: "https://www.tdtnews.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Weatherford Democrat",
    websiteUrl: "https://www.weatherforddemocrat.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/parker"],
    feeds: [{ url: "https://www.weatherforddemocrat.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Cleburne Times-Review",
    websiteUrl: "https://www.cleburnetimesreview.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/johnson"],
    feeds: [{ url: "https://www.cleburnetimesreview.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Corsicana Daily Sun",
    websiteUrl: "https://www.corsicanadailysun.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/navarro"],
    feeds: [{ url: "https://www.corsicanadailysun.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Palestine Herald-Press",
    websiteUrl: "https://www.palestineherald.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/anderson"],
    feeds: [{ url: "https://www.palestineherald.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Jacksonville Progress",
    websiteUrl: "https://www.jacksonvilleprogress.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/cherokee"],
    feeds: [{ url: "https://www.jacksonvilleprogress.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Gainesville Daily Register",
    websiteUrl: "https://www.gainesvilleregister.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/cooke"],
    feeds: [{ url: "https://www.gainesvilleregister.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "The Comanche Chief",
    websiteUrl: "https://www.thecomanchechief.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/comanche"],
    feeds: [{ url: "https://www.thecomanchechief.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "Moore County News-Press",
    websiteUrl: "https://www.moorenews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/moore"],
    feeds: [{ url: "https://www.moorenews.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "The Bowie News",
    websiteUrl: "https://www.bowienewsonline.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/montague"],
    feeds: [{ url: "https://bowienewsonline.com/feed/" }],
    trustedForCountyTier: false,
  },
  {
    name: "The Highlander",
    websiteUrl: "https://www.highlandernews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/burnet"],
    feeds: [{ url: "https://www.highlandernews.com/search/?f=rss&t=article&l=25&s=start_time&sd=desc" }],
    trustedForCountyTier: false,
  },
  {
    name: "KRGV Channel 5 News",
    websiteUrl: "https://www.krgv.com/",
    outletTypes: ["television"],
    aliases: ["KRGV"],
    counties: ["texas/hidalgo"],
  },
  {
    name: "Lubbock Avalanche-Journal",
    websiteUrl: "https://www.lubbockonline.com/",
    outletTypes: ["newspaper"],
    aliases: ["lubbockonline.com"],
    counties: ["texas/lubbock"],
  },
  {
    name: "Midland Reporter-Telegram",
    websiteUrl: "https://www.mrt.com/",
    outletTypes: ["newspaper"],
    aliases: ["mrt.com"],
    counties: ["texas/midland"],
  },
  {
    name: "Abilene Reporter-News",
    websiteUrl: "https://www.reporternews.com/",
    outletTypes: ["newspaper"],
    aliases: ["Reporter-News"],
    counties: ["texas/taylor"],
  },
  {
    name: "Laredo Morning Times",
    websiteUrl: "https://www.lmtonline.com/",
    outletTypes: ["newspaper"],
    aliases: ["lmtonline.com"],
    counties: ["texas/webb"],
  },
  {
    name: "Texarkana Gazette",
    websiteUrl: "https://www.texarkanagazette.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/bowie"],
  },
  {
    name: "Wood County Monitor",
    websiteUrl: "https://woodcountymonitor.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/wood"],
  },
  {
    name: "Plainview Herald",
    websiteUrl: "https://www.myplainview.com/",
    outletTypes: ["newspaper"],
    aliases: ["myplainview.com"],
    counties: ["texas/hale"],
  },
  {
    name: "The Courier of Montgomery County",
    websiteUrl: "https://www.yourconroenews.com/",
    outletTypes: ["newspaper"],
    aliases: ["The Courier", "yourconroenews.com"],
    counties: ["texas/montgomery"],
  },
  {
    name: "Hood County News",
    websiteUrl: "https://www.hcnews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/hood"],
  },
  {
    name: "The High Plains Brand",
    websiteUrl: "https://www.thecastrocountynews.com/",
    outletTypes: ["newspaper"],
    aliases: ["Hereford Brand", "Castro County News"],
    counties: ["texas/deaf-smith", "texas/castro", "texas/swisher"],
  },
  {
    name: "Seminole Sentinel",
    websiteUrl: "https://www.seminolesentinel.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/gaines"],
  },
  {
    name: "Port Lavaca Wave",
    websiteUrl: "https://www.portlavacawave.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/calhoun"],
  },
  {
    name: "Houston County Courier",
    websiteUrl: "https://www.houstoncountycourier.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/houston"],
  },
  {
    name: "The Hillsboro Reporter",
    websiteUrl: "https://hillsbororeporter.com/",
    outletTypes: ["newspaper", "radio"],
    aliases: ["KHBR"],
    counties: ["texas/hill"],
  },
  {
    name: "The Ozona Stockman",
    websiteUrl: "https://www.ozonastockman.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/crockett"],
  },
  {
    name: "Brady Standard-Herald",
    websiteUrl: "https://www.bradystandard.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/mcculloch"],
  },
  {
    name: "The Eldorado Success",
    websiteUrl: "https://www.myeldorado.net/",
    outletTypes: ["newspaper"],
    counties: ["texas/schleicher"],
  },
  {
    name: "The Pampa News",
    websiteUrl: "https://www.thepampanews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/gray"],
  },
  {
    name: "The Gonzales Inquirer",
    websiteUrl: "https://gonzalesinquirer.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/gonzales"],
  },
  {
    name: "The Dalhart Texan",
    websiteUrl: "https://www.thedalharttexan.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/dallam", "texas/hartley"],
  },
  {
    name: "Friona Star",
    websiteUrl: "https://www.frionaonline.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/parmer"],
  },
  {
    name: "DeWitt County Today",
    websiteUrl: "https://www.dewittcountytoday.com/",
    outletTypes: ["newspaper"],
    aliases: ["The Cuero Record"],
    counties: ["texas/dewitt"],
  },
  {
    name: "The Brownfield News",
    websiteUrl: "https://www.brownfieldonline.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/terry"],
  },
  {
    name: "San Augustine Tribune",
    websiteUrl: "https://www.sanaugustinetribune.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/san-augustine"],
  },
  {
    name: "The Junction Eagle",
    websiteUrl: "https://junctioneagle.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/kimble"],
  },
  {
    name: "The Greenbelt Intrepid",
    websiteUrl: "https://www.the-intrepid.com/",
    outletTypes: ["newspaper"],
    aliases: ["Red River Sun", "The Wellington Leader"],
    counties: ["texas/childress", "texas/collingsworth", "texas/hall"],
  },
  {
    name: "Mount Pleasant Tribune",
    websiteUrl: "https://www.tribnow.com/",
    outletTypes: ["newspaper"],
    aliases: ["tribnow.com", "Mount Pleasant Daily Tribune"],
    counties: ["texas/titus"],
  },
  {
    name: "DailyTrib.com",
    websiteUrl: "https://www.dailytrib.com/",
    outletTypes: ["digital", "radio"],
    aliases: ["The Picayune"],
    counties: ["texas/burnet"],
  },
  {
    name: "The Silsbee Bee",
    websiteUrl: "https://www.silsbee-bee.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/hardin"],
  },
  {
    name: "MyHighPlains (KAMR/KCIT)",
    websiteUrl: "https://www.myhighplains.com/",
    outletTypes: ["television"],
    aliases: ["MyHighPlains", "KAMR Local 4 News"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "ABC7 Amarillo (KVII)",
    websiteUrl: "https://abc7amarillo.com/",
    outletTypes: ["television"],
    aliases: ["ABC7 Amarillo", "KVII"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "Amarillo Tribune",
    websiteUrl: "https://www.amarillotribune.org/",
    outletTypes: ["digital"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "Hill Country Passport",
    websiteUrl: "https://www.hillcountrypassport.com/",
    outletTypes: ["newspaper"],
    aliases: ["The Llano News", "Mason County News", "Blanco County News"],
    counties: ["texas/llano", "texas/mason", "texas/blanco"],
    trustedForCountyTier: false,
  },
  {
    name: "East Texas News",
    websiteUrl: "https://www.easttexasnews.com/",
    outletTypes: ["newspaper"],
    aliases: ["Polk County Enterprise", "Tyler County Booster", "San Jacinto News-Times", "Trinity Standard"],
    counties: ["texas/polk", "texas/tyler", "texas/trinity", "texas/san-jacinto"],
    trustedForCountyTier: false,
  },
  {
    name: "North Texas e-News",
    websiteUrl: "https://www.ntxe-news.com/",
    outletTypes: ["digital"],
    counties: ["texas/fannin"],
    trustedForCountyTier: false,
  },
  {
    name: "Zapata County News",
    websiteUrl: "https://www.zapatacountynews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/zapata"],
    trustedForCountyTier: false,
  },
  {
    name: "Cross Plains Review",
    websiteUrl: "https://www.crossplainsreview.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/callahan"],
    trustedForCountyTier: false,
  },
  {
    name: "Observer/Enterprise",
    websiteUrl: "http://www.observerenterprise.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/coke"],
    trustedForCountyTier: false,
  },
  {
    name: "Foard County News",
    websiteUrl: "https://www.foardcountynews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/foard"],
    trustedForCountyTier: false,
  },
  {
    name: "The Texas Spur",
    websiteUrl: "https://www.texasspur.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/dickens"],
    trustedForCountyTier: false,
  },
  {
    name: "Mexia News",
    websiteUrl: "https://www.mexiadailynews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/limestone"],
    trustedForCountyTier: false,
  },
  {
    name: "Freestone County Times / Recorder-Chronicle",
    websiteUrl: "https://www.fcrecorderchronicle.com/",
    outletTypes: ["newspaper"],
    aliases: ["Fairfield Recorder"],
    counties: ["texas/freestone"],
    trustedForCountyTier: false,
  },
  {
    name: "Wharton County Leader-Journal",
    websiteUrl: "https://www.wcleaderjournal.com/",
    outletTypes: ["newspaper"],
    aliases: ["Wharton Journal-Spectator"],
    counties: ["texas/wharton"],
    trustedForCountyTier: false,
  },
  {
    name: "Rains County Leader",
    websiteUrl: "http://www.rainscountyleader.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/rains"],
    trustedForCountyTier: false,
  },
  {
    name: "The Clarendon Enterprise",
    websiteUrl: "https://www.clarendonlive.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/donley"],
    trustedForCountyTier: false,
  },
  {
    name: "The 830 Times",
    websiteUrl: "https://www.830times.com/",
    outletTypes: ["digital"],
    aliases: ["Del Rio News"],
    counties: ["texas/val-verde"],
    trustedForCountyTier: false,
  },
  {
    name: "Quanah Tribune-Chief",
    websiteUrl: "https://www.quanahtribunechief.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/hardeman"],
    trustedForCountyTier: false,
  },

  // === Metro depth pass, September 2026 ===
  // Multiple outlets per major county. Every metro TV feed sits untrusted:
  // the same syndicated national stories appeared verbatim across the
  // TEGNA/Gray/Graham/Scripps/Sinclair feeds probed (and KXAN's Nexstar feed
  // carried national tech stories), so their local coverage earns its place
  // through the text rules. The big dailies are trusted feedless — their
  // site: search queries are place-constrained, which keeps syndicated wire
  // out without a feed to filter. Fort Bend Star rejected: published its
  // farewell edition April 2026.
  {
    name: "Dallas Free Press",
    websiteUrl: "https://dallasfreepress.com/",
    outletTypes: ["digital"],
    counties: ["texas/dallas"],
    feeds: [{ url: "https://dallasfreepress.com/feed/" }],
  },
  {
    name: "Dallas Observer",
    websiteUrl: "https://www.dallasobserver.com/",
    outletTypes: ["digital"],
    counties: ["texas/dallas"],
    feeds: [{ url: "https://www.dallasobserver.com/feed/" }],
  },
  {
    name: "D Magazine",
    websiteUrl: "https://www.dmagazine.com/",
    outletTypes: ["digital"],
    counties: ["texas/dallas"],
    feeds: [{ url: "https://www.dmagazine.com/feed/google-discover-feed" }],
  },
  {
    name: "Houston Press",
    websiteUrl: "https://www.houstonpress.com/",
    outletTypes: ["digital"],
    counties: ["texas/harris"],
    feeds: [{ url: "https://www.houstonpress.com/feed/" }],
  },
  {
    name: "The Austin Chronicle",
    websiteUrl: "https://www.austinchronicle.com/",
    outletTypes: ["digital"],
    counties: ["texas/travis"],
    feeds: [{ url: "https://www.austinchronicle.com/feed/" }],
  },
  {
    name: "The Wilco Sun",
    websiteUrl: "https://www.wilcosun.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/williamson"],
    feeds: [{ url: "https://www.wilcosun.com/rss.xml" }],
  },
  {
    name: "Local Profile",
    websiteUrl: "https://localprofile.com/",
    outletTypes: ["digital"],
    counties: ["texas/collin"],
    feeds: [{ url: "https://localprofile.com/rss" }],
  },
  {
    name: "WFAA",
    websiteUrl: "https://www.wfaa.com/",
    outletTypes: ["television"],
    counties: ["texas/dallas", "texas/tarrant"],
    feeds: [{ url: "https://www.wfaa.com/feeds/syndication/rss/news" }],
    trustedForCountyTier: false,
  },
  {
    name: "FOX 4 News",
    websiteUrl: "https://www.fox4news.com/",
    outletTypes: ["television"],
    counties: ["texas/dallas", "texas/tarrant"],
    feeds: [{ url: "https://www.fox4news.com/rss.xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "NBC 5 Dallas-Fort Worth",
    websiteUrl: "https://www.nbcdfw.com/",
    outletTypes: ["television"],
    counties: ["texas/dallas", "texas/tarrant"],
    feeds: [{ url: "https://www.nbcdfw.com/?rss=y" }],
    trustedForCountyTier: false,
  },
  {
    name: "Fort Worth Weekly",
    websiteUrl: "https://www.fwweekly.com/",
    outletTypes: ["newspaper", "digital"],
    counties: ["texas/tarrant"],
    feeds: [{ url: "https://www.fwweekly.com/feed/" }],
    trustedForCountyTier: false,
  },
  {
    name: "KHOU 11",
    websiteUrl: "https://www.khou.com/",
    outletTypes: ["television"],
    counties: ["texas/harris"],
    feeds: [{ url: "https://www.khou.com/feeds/syndication/rss/news" }],
    trustedForCountyTier: false,
  },
  {
    name: "ABC13 Houston",
    websiteUrl: "https://abc13.com/",
    outletTypes: ["television"],
    counties: ["texas/harris"],
    feeds: [{ url: "https://abc13.com/feed/" }],
    trustedForCountyTier: false,
  },
  {
    name: "FOX 26 Houston",
    websiteUrl: "https://www.fox26houston.com/",
    outletTypes: ["television"],
    counties: ["texas/harris"],
    feeds: [{ url: "https://www.fox26houston.com/rss.xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "Texas Public Radio",
    websiteUrl: "https://www.tpr.org/",
    outletTypes: ["radio", "digital"],
    counties: ["texas/bexar"],
    feeds: [{ url: "https://www.tpr.org/index.rss" }],
    trustedForCountyTier: false,
  },
  {
    name: "KENS 5",
    websiteUrl: "https://www.kens5.com/",
    outletTypes: ["television"],
    counties: ["texas/bexar"],
    feeds: [{ url: "https://www.kens5.com/feeds/syndication/rss/news" }],
    trustedForCountyTier: false,
  },
  {
    name: "KSAT 12",
    websiteUrl: "https://www.ksat.com/",
    outletTypes: ["television"],
    counties: ["texas/bexar"],
    feeds: [{ url: "https://www.ksat.com/arc/outboundfeeds/rss/?outputType=xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "KXAN",
    websiteUrl: "https://www.kxan.com/",
    outletTypes: ["television"],
    counties: ["texas/travis"],
    feeds: [{ url: "https://www.kxan.com/feed/" }],
    trustedForCountyTier: false,
  },
  {
    name: "FOX 7 Austin",
    websiteUrl: "https://www.fox7austin.com/",
    outletTypes: ["television"],
    counties: ["texas/travis"],
    feeds: [{ url: "https://www.fox7austin.com/rss.xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "KVIA ABC-7",
    websiteUrl: "https://kvia.com/",
    outletTypes: ["television"],
    counties: ["texas/el-paso"],
    feeds: [{ url: "https://kvia.com/feed/" }],
    trustedForCountyTier: false,
  },
  {
    name: "6 News KCEN",
    websiteUrl: "https://www.kcentv.com/",
    outletTypes: ["television"],
    counties: ["texas/bell"],
    feeds: [{ url: "https://www.kcentv.com/feeds/syndication/rss/news" }],
    trustedForCountyTier: false,
  },
  {
    name: "KCBD NewsChannel 11",
    websiteUrl: "https://www.kcbd.com/",
    outletTypes: ["television"],
    counties: ["texas/lubbock"],
    feeds: [{ url: "https://www.kcbd.com/arc/outboundfeeds/rss/?outputType=xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "KBTX",
    websiteUrl: "https://www.kbtx.com/",
    outletTypes: ["television"],
    counties: ["texas/brazos"],
    feeds: [{ url: "https://www.kbtx.com/arc/outboundfeeds/rss/?outputType=xml" }],
    trustedForCountyTier: false,
  },
  {
    name: "The Dallas Morning News",
    websiteUrl: "https://www.dallasnews.com/",
    outletTypes: ["newspaper"],
    aliases: ["dallasnews.com"],
    counties: ["texas/dallas"],
  },
  {
    name: "Fort Worth Star-Telegram",
    websiteUrl: "https://www.star-telegram.com/",
    outletTypes: ["newspaper"],
    aliases: ["Star-Telegram"],
    counties: ["texas/tarrant"],
  },
  {
    name: "Houston Chronicle",
    websiteUrl: "https://www.chron.com/",
    outletTypes: ["newspaper"],
    aliases: ["chron.com"],
    counties: ["texas/harris"],
  },
  {
    name: "San Antonio Express-News",
    websiteUrl: "https://www.expressnews.com/",
    outletTypes: ["newspaper"],
    aliases: ["expressnews.com"],
    counties: ["texas/bexar"],
  },
  {
    name: "MySA",
    websiteUrl: "https://www.mysanantonio.com/",
    outletTypes: ["digital"],
    aliases: ["mysanantonio.com", "My San Antonio"],
    counties: ["texas/bexar"],
  },
  {
    name: "Austin American-Statesman",
    websiteUrl: "https://www.statesman.com/",
    outletTypes: ["newspaper"],
    aliases: ["statesman.com"],
    counties: ["texas/travis"],
  },
  {
    name: "El Paso Times",
    websiteUrl: "https://www.elpasotimes.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/el-paso"],
  },
  {
    name: "Corpus Christi Caller-Times",
    websiteUrl: "https://www.caller.com/",
    outletTypes: ["newspaper"],
    aliases: ["Caller-Times", "caller.com"],
    counties: ["texas/nueces"],
  },
  {
    name: "Beaumont Enterprise",
    websiteUrl: "https://www.beaumontenterprise.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/jefferson"],
  },
  {
    name: "Waco Tribune-Herald",
    websiteUrl: "https://wacotrib.com/",
    outletTypes: ["newspaper"],
    aliases: ["wacotrib.com"],
    counties: ["texas/mclennan"],
  },
  {
    name: "The Eagle",
    websiteUrl: "https://theeagle.com/",
    outletTypes: ["newspaper"],
    aliases: ["Bryan-College Station Eagle", "theeagle.com"],
    counties: ["texas/brazos"],
  },
  {
    name: "Hill Country News",
    websiteUrl: "https://www.hillcountrynews.com/",
    outletTypes: ["newspaper"],
    counties: ["texas/williamson"],
  },
  {
    name: "CBS Austin",
    websiteUrl: "https://cbsaustin.com/",
    outletTypes: ["television"],
    aliases: ["KEYE"],
    counties: ["texas/travis"],
    trustedForCountyTier: false,
  },
  {
    name: "KFOX14",
    websiteUrl: "https://kfoxtv.com/",
    outletTypes: ["television"],
    counties: ["texas/el-paso"],
    trustedForCountyTier: false,
  },
];

const directSources: DirectSource[] = [
  {
    name: "NPR News",
    url: "https://feeds.npr.org/1001/rss.xml",
    mediaType: "article",
    topics: ["general", "politics", "economy", "crime", "opinion"],
  },
  {
    name: "ABC7 Amarillo Local",
    url: "https://abc7amarillo.com/news/local.rss",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "ABC7 Amarillo Video",
    url: "https://abc7amarillo.com/news/videos.rss",
    mediaType: "video",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "ABC7 Amarillo Watch",
    url: "https://abc7amarillo.com/watch.rss",
    mediaType: "video",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "MyHighPlains News",
    url: "https://www.myhighplains.com/news/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "MyHighPlains Local News",
    url: "https://www.myhighplains.com/news/local-news/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "MyHighPlains Today in Amarillo",
    url: "https://www.myhighplains.com/news/today-in-amarillo/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "MyHighPlains Podcasts",
    url: "https://www.myhighplains.com/podcasts/feed/",
    mediaType: "podcast",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "Amarillo Tribune",
    url: "https://www.amarillotribune.org/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["amarillo"],
    counties: ["texas/potter", "texas/randall"],
  },
  {
    name: "KLTV East Texas News",
    url: "https://www.kltv.com/arc/outboundfeeds/rss/category/news/?outputType=xml",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "CBS19 Tyler News",
    url: "https://www.cbs19.tv/feeds/syndication/rss/news",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "KETK East Texas",
    url: "https://www.ketk.com/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "KETK Local News",
    url: "https://www.ketk.com/news/local-news/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "KETK Top Stories",
    url: "https://www.ketk.com/news/top-stories/feed/",
    mediaType: "article",
    states: ["texas"],
    markets: ["tyler"],
  },
  {
    name: "Denver7 Local News",
    url: "https://www.denver7.com/news/local-news.rss",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
  {
    name: "Denver7 News",
    url: "https://www.denver7.com/news.rss",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
  {
    name: "CBS Colorado",
    url: "https://www.cbsnews.com/colorado/latest/rss/main",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
  {
    name: "Denverite",
    url: "https://denverite.com/feed/",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
  {
    name: "Westword",
    url: "https://www.westword.com/index.rss",
    mediaType: "article",
    states: ["colorado"],
    markets: ["denver"],
    counties: ["colorado/denver"],
  },
];

export function getDirectSources(scope: FeedScope, topic: Topic, marketCities: string[] = []) {
  return allDirectSources().filter(
    (source) => sourceMatchesTopic(source, topic) && sourceMatchesScope(source, scope, marketCities),
  );
}

/** Reviewed outlets first, then the ones discovery observed. */
function allCountyNativeSources(): CountyNativeSource[] {
  return [...countyNativeSources, ...discoveredCountyNativeSources];
}

export function getCountyNativeSources(county: CountySite, topic?: Topic) {
  const countyKey = countySourceKey(county);
  return allCountyNativeSources().filter(
    (source) => source.counties.includes(countyKey) && (!topic || !source.topics?.length || source.topics.includes(topic)),
  );
}

/**
 * The reviewed outlets for a county in a shape safe to publish: this backs
 * `/v1/sources/counties/...`, which the frontend's Local Sources directory
 * renders. Reviewed entries only — discovery output is fetched, never listed
 * as a verified outlet. The frontend keeps no copy of this list; it drifted
 * once and Potter County showed "no sources" while three Amarillo newsrooms
 * were trusted here.
 */
export function getReviewedCountySourceProfiles(county: CountySite) {
  const countyKey = countySourceKey(county);
  return countyNativeSources
    .filter((source) => source.counties.includes(countyKey))
    .map(({ name, websiteUrl, outletTypes, aliases }) => ({ name, websiteUrl, outletTypes, aliases }));
}

export function getMarketSourcesForCounty(county: CountySite, topic: Topic, marketCities: string[]) {
  const markets = marketCities.map((city) => city.toLowerCase());
  return allDirectSources().filter(
    (source) =>
      sourceMatchesTopic(source, topic) &&
      source.trustedForMarketTier !== false &&
      source.states?.includes(county.state.slug) === true &&
      source.markets?.some((market) => markets.includes(market.toLowerCase())) === true,
  );
}

export function isTrustedMarketSource(item: NewsFeedItem, sources: DirectSource[]) {
  const sourceName = item.source?.trim().toLowerCase();
  if (sourceName && sources.some((source) => source.name.toLowerCase() === sourceName)) return true;
  const itemDomain = hostname(item.link);
  return Boolean(itemDomain && sources.some((source) => hostname(source.url) === itemDomain));
}

/**
 * Hostnames whose stories count as county-local without naming the county.
 *
 * Published in the API response because the browser re-checks locality on what
 * it receives and has no copy of this registry: it was discarding items the API
 * had accepted through exactly this rule, which is why county desks showed a
 * handful of stories out of the fifty they were sent.
 */
export function trustedCountyHosts(county: CountySite): string[] {
  const countyKey = countySourceKey(county);
  const hosts = [
    ...allDirectSources()
      .filter((source) => source.counties?.includes(countyKey) && source.trustedForCountyTier !== false)
      .map((source) => hostname(source.url)),
    ...getCountyNativeSources(county)
      .filter((source) => source.trustedForCountyTier !== false)
      .map((source) => hostname(source.websiteUrl)),
  ];
  return Array.from(new Set(hosts.filter(Boolean)));
}

export function isTrustedCountySource(item: NewsFeedItem, sources: DirectSource[], county: CountySite) {
  const countyKey = countySourceKey(county);
  const countySources = sources.filter(
    (source) => source.counties?.includes(countyKey) && source.trustedForCountyTier !== false,
  );
  const itemDomain = hostname(item.link);
  if (itemDomain && countySources.some((source) => hostname(source.url) === itemDomain)) return true;

  const nativeSources = getCountyNativeSources(county).filter((source) => source.trustedForCountyTier !== false);
  if (itemDomain && nativeSources.some((source) => hostname(source.websiteUrl) === itemDomain)) return true;

  if (!isSearchAggregatorDomain(itemDomain)) return false;
  const sourceName = normalizePublisherName(item.source);
  return Boolean(
    sourceName &&
      nativeSources.some((source) =>
        [source.name, ...(source.aliases || [])].some((alias) => normalizePublisherName(alias) === sourceName),
      ),
  );
}

function sourceMatchesTopic(source: DirectSource, topic: Topic) {
  return !source.topics?.length || source.topics.includes(topic);
}

function allDirectSources(): DirectSource[] {
  return [
    ...directSources,
    ...discoveredRegionalSources,
    ...allCountyNativeSources().flatMap((source) =>
      (source.feeds || []).map((feed) => ({
        name: feed.name || source.name,
        url: feed.url,
        mediaType: "article" as const,
        itemSource: source.name,
        topics: feed.topics || source.topics,
        counties: source.counties,
        maxAgeDays: feed.maxAgeDays,
        maxItems: feed.maxItems,
        // Reviewed-but-untrusted outlets must stay untrusted when their feeds
        // are flattened into direct sources, or the flag is meaningless.
        trustedForCountyTier: source.trustedForCountyTier,
      })),
    ),
  ];
}

function sourceMatchesScope(source: DirectSource, scope: FeedScope, marketCities: string[]) {
  if (scope.level === "national") return !source.states?.length && !source.markets?.length && !source.counties?.length;

  const state = scope.level === "state" ? scope.state : scope.county.state;
  if (scope.level === "state") {
    return Boolean(source.states?.includes(state.slug) && !source.markets?.length && !source.counties?.length);
  }

  if (scope.level === "county") {
    const countyKey = countySourceKey(scope.county);
    if (source.counties?.includes(countyKey)) return true;
    const markets = marketCities.map((city) => city.toLowerCase());
    return Boolean(source.markets?.some((market) => markets.includes(market)));
  }

  return false;
}

function hostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSearchAggregatorDomain(domain: string) {
  return domain === "news.google.com" || domain === "bing.com" || domain.endsWith(".bing.com");
}

function normalizePublisherName(value?: string) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function countySourceKey(county: CountySite) {
  return `${county.state.slug}/${county.slug}`;
}
