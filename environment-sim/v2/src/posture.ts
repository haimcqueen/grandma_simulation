import { CAUTIOUS, ADULT_MOTION, TODDLER_MOTION, CRAWLING_MOTION, DOG_MOTION } from "../../v1-draft/src/robot/motion";
import { STOOPED, UPRIGHT, TODDLING } from "../../v1-draft/src/robot/stance";
import { BABY_CRAWL, TROT, type CrawlStyle } from "../../v1-draft/src/robot/crawl";

export const postures = {
  grandma: { stance: STOOPED, motion: CAUTIOUS, speed: 0.77, asset: "g1", label: "G1 · Grandma, cautious steps", maxHeight: 1.7, crawl: undefined as CrawlStyle | undefined },
  upright: { stance: UPRIGHT, motion: ADULT_MOTION, speed: 1.3, asset: "g1", label: "G1 · Upright", maxHeight: 1.7, crawl: undefined as CrawlStyle | undefined },
  adult: { stance: UPRIGHT, motion: ADULT_MOTION, speed: 1.3, asset: "h1", label: "H1 · Adult", maxHeight: 1.7, crawl: undefined as CrawlStyle | undefined },
  toddler: { stance: TODDLING, motion: TODDLER_MOTION, speed: 0.55, asset: "g1", label: "G1 · Toddler stand-in", maxHeight: 0.95, crawl: undefined as CrawlStyle | undefined },
  baby: { stance: UPRIGHT, motion: CRAWLING_MOTION, speed: 0.28, asset: "go2", label: "Go2 · Infant crawl stand-in", maxHeight: 0.72, crawl: BABY_CRAWL as CrawlStyle | undefined },
  dog: { stance: UPRIGHT, motion: DOG_MOTION, speed: 1.1, asset: "go2", label: "Go2 · Dog trot", maxHeight: 0.55, crawl: TROT as CrawlStyle | undefined },
};
export type Posture = keyof typeof postures;
