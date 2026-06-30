import { describe, it, expect } from "vitest";
import {
  toFormat,
  parseStoryId,
  videoMetrics,
  engagementMetrics,
  aggregateInsights,
  ageIndex,
  genderIndex,
  hourBucket12,
  weekdayIndexMon,
  emptyAudience,
  mergeAudience,
  buildAudienceProfile,
  type MetaInsightRow,
} from "./map";

describe("toFormat", () => {
  it("maps VIDEO and carousel object types", () => {
    expect(toFormat("VIDEO")).toBe("VIDEO");
    expect(toFormat("video")).toBe("VIDEO");
    expect(toFormat("CAROUSEL")).toBe("CAROUSEL");
    expect(toFormat("MULTI_SHARE")).toBe("CAROUSEL");
  });

  it("maps photo/share/status/unknown to IMAGE", () => {
    expect(toFormat("PHOTO")).toBe("IMAGE");
    expect(toFormat("SHARE")).toBe("IMAGE");
    expect(toFormat("STATUS")).toBe("IMAGE");
    expect(toFormat("something-new")).toBe("IMAGE");
    expect(toFormat(undefined)).toBe("IMAGE");
  });
});

describe("parseStoryId", () => {
  it("splits {page}_{post} on the first underscore", () => {
    expect(parseStoryId("123_456")).toEqual({ pageId: "123", postId: "456" });
    expect(parseStoryId("123_456_789")).toEqual({ pageId: "123", postId: "456_789" });
  });

  it("returns null for unsplittable / empty input", () => {
    expect(parseStoryId("abc")).toBeNull();
    expect(parseStoryId("_456")).toBeNull();
    expect(parseStoryId("123_")).toBeNull();
    expect(parseStoryId(undefined)).toBeNull();
  });
});

describe("videoMetrics", () => {
  it("reads 3s plays from actions and funnel from video_* fields", () => {
    const row: MetaInsightRow = {
      impressions: "1000",
      actions: [{ action_type: "video_view", value: "400" }],
      video_thruplay_watched_actions: [{ action_type: "video_view", value: "150" }],
      video_p25_watched_actions: [{ action_type: "video_view", value: "300" }],
      video_p50_watched_actions: [{ action_type: "video_view", value: "200" }],
      video_p75_watched_actions: [{ action_type: "video_view", value: "120" }],
      video_p100_watched_actions: [{ action_type: "video_view", value: "80" }],
      video_avg_time_watched_actions: [{ action_type: "video_view", value: "6.5" }],
    };
    const v = videoMetrics(row);
    expect(v.plays3s).toBe(400);
    expect(v.thruplays).toBe(150);
    expect(v.p25).toBe(300);
    expect(v.p100).toBe(80);
    expect(v.avgWatchSec).toBeCloseTo(6.5);
    expect(v.hookRate).toBeCloseTo(40); // 400/1000 * 100
    expect(v.holdRate).toBeCloseTo(15); // 150/1000 * 100
  });

  it("returns zeros (not NaN) for an image creative with no video data", () => {
    const v = videoMetrics({ impressions: "0" });
    expect(v).toMatchObject({ plays3s: 0, thruplays: 0, hookRate: 0, holdRate: 0, avgWatchSec: 0 });
    expect(Number.isNaN(v.hookRate)).toBe(false);
  });
});

describe("engagementMetrics", () => {
  it("pulls reactions/comments/shares/saves from the actions array", () => {
    const row: MetaInsightRow = {
      actions: [
        { action_type: "post_reaction", value: "1204" },
        { action_type: "comment", value: "88" },
        { action_type: "post", value: "45" },
        { action_type: "onsite_conversion.post_save", value: "12" },
        { action_type: "post_engagement", value: "1500" },
      ],
    };
    expect(engagementMetrics(row)).toEqual({
      reactions: 1204,
      comments: 88,
      shares: 45,
      saves: 12,
      postEngagement: 1500,
    });
  });

  it("defaults to zeros when actions are absent", () => {
    expect(engagementMetrics({})).toEqual({
      reactions: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      postEngagement: 0,
    });
  });
});

describe("aggregateInsights", () => {
  const a: MetaInsightRow = {
    spend: "100",
    impressions: "1000",
    clicks: "20",
    reach: "800",
    purchase_roas: [{ action_type: "omni_purchase", value: "5" }],
    actions: [
      { action_type: "omni_purchase", value: "10" },
      { action_type: "video_view", value: "400" },
      { action_type: "post_reaction", value: "30" },
    ],
    cost_per_action_type: [{ action_type: "omni_purchase", value: "10" }],
    video_avg_time_watched_actions: [{ action_type: "video_view", value: "6" }],
  };
  const b: MetaInsightRow = {
    spend: "300",
    impressions: "3000",
    clicks: "120",
    reach: "2000",
    purchase_roas: [{ action_type: "omni_purchase", value: "3" }],
    actions: [
      { action_type: "omni_purchase", value: "30" },
      { action_type: "video_view", value: "600" },
      { action_type: "post_reaction", value: "70" },
    ],
    cost_per_action_type: [{ action_type: "omni_purchase", value: "10" }],
    video_avg_time_watched_actions: [{ action_type: "video_view", value: "4" }],
  };

  it("sums additive counts and recomputes rates from the sums (not averaged)", () => {
    const agg = aggregateInsights([a, b]);
    expect(agg.spend).toBe(400);
    expect(agg.impressions).toBe(4000);
    expect(agg.clicks).toBe(140);
    expect(agg.purchases).toBe(40);
    // ctr = Σclicks/Σimpr*100 = 140/4000*100 = 3.5 (NOT the avg of 2% and 4%)
    expect(agg.ctr).toBeCloseTo(3.5);
    // blended roas = Σ(roas·spend)/Σspend = (5·100 + 3·300)/400 = 1400/400 = 3.5
    expect(agg.roas).toBeCloseTo(3.5);
    // cpa = Σspend/Σpurchases = 400/40 = 10
    expect(agg.cpa).toBeCloseTo(10);
    // hookRate = Σplays3s/Σimpr*100 = 1000/4000*100 = 25
    expect(agg.video.hookRate).toBeCloseTo(25);
    // avg watch weighted by plays: (6·400 + 4·600)/1000 = 4800/1000 = 4.8
    expect(agg.video.avgWatchSec).toBeCloseTo(4.8);
    expect(agg.engagement.reactions).toBe(100);
  });

  it("never produces NaN/Infinity on empty input", () => {
    const agg = aggregateInsights([]);
    expect(agg.ctr).toBe(0);
    expect(agg.roas).toBe(0);
    expect(agg.cpa).toBe(0);
    expect(agg.video.hookRate).toBe(0);
    expect(agg.video.avgWatchSec).toBe(0);
    expect(Number.isFinite(agg.frequency)).toBe(true);
  });
});

describe("audience index helpers", () => {
  it("ageIndex maps Meta brackets (13-17 folded into 18-24)", () => {
    expect(ageIndex("18-24")).toBe(0);
    expect(ageIndex("13-17")).toBe(0);
    expect(ageIndex("25-34")).toBe(1);
    expect(ageIndex("65+")).toBe(5);
    expect(ageIndex("weird")).toBe(-1);
  });

  it("genderIndex maps female/male/unknown", () => {
    expect(genderIndex("female")).toBe(0);
    expect(genderIndex("Male")).toBe(1);
    expect(genderIndex("unknown")).toBe(2);
    expect(genderIndex("")).toBe(2);
  });

  it("hourBucket12 turns an hourly label into a two-hour bucket", () => {
    expect(hourBucket12("00:00:00 - 00:59:59")).toBe(0);
    expect(hourBucket12("13:00:00 - 13:59:59")).toBe(6);
    expect(hourBucket12("23:00:00 - 23:59:59")).toBe(11);
    expect(hourBucket12("")).toBe(-1);
  });

  it("weekdayIndexMon maps a date to Mon=0..Sun=6", () => {
    expect(weekdayIndexMon("2021-01-04")).toBe(0); // Monday
    expect(weekdayIndexMon("2021-01-09")).toBe(5); // Saturday
    expect(weekdayIndexMon("2021-01-10")).toBe(6); // Sunday
    expect(weekdayIndexMon("not-a-date")).toBe(-1);
  });
});

describe("buildAudienceProfile", () => {
  it("normalizes each dimension and keeps the top regions with labels", () => {
    const a = emptyAudience();
    a.age = [10, 30, 20, 0, 0, 0]; // sum 60
    a.gender = [60, 40, 0];
    a.region = { Bangkok: 70, "Chiang Mai": 30 };
    a.day = [1, 1, 1, 1, 1, 1, 1];
    a.hour[0] = 5;
    const p = buildAudienceProfile(a)!;
    expect(p.age[1]).toBeCloseTo(50); // 30/60
    expect(p.age[2]).toBeCloseTo(33.3, 1);
    expect(p.gender).toEqual([60, 40, 0]);
    expect(p.province).toEqual([70, 30]);
    expect(p.provinceLabels).toEqual(["กรุงเทพฯ · Bangkok", "เชียงใหม่ · CM"]);
    expect(p.day[0]).toBeCloseTo(100 / 7, 1);
  });

  it("merges per-ad accumulators then normalizes", () => {
    const acc = emptyAudience();
    const ad1 = emptyAudience();
    ad1.age[0] = 100;
    ad1.region = { Bangkok: 100 };
    const ad2 = emptyAudience();
    ad2.age[1] = 100;
    ad2.region = { Bangkok: 50, Nonthaburi: 50 };
    mergeAudience(acc, ad1);
    mergeAudience(acc, ad2);
    const p = buildAudienceProfile(acc)!;
    expect(p.age[0]).toBeCloseTo(50);
    expect(p.age[1]).toBeCloseTo(50);
    expect(p.province[0]).toBeCloseTo(75); // Bangkok 150 / 200
    expect(p.provinceLabels![0]).toBe("กรุงเทพฯ · Bangkok");
  });

  it("returns null when there is no audience data", () => {
    expect(buildAudienceProfile(emptyAudience())).toBeNull();
  });
});
