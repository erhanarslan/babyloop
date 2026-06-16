"use client";

import { HomeFeaturedShowcase } from "./home-featured-showcase";
import { HomeLatestListingsSection } from "./home-latest-listings-section";

type HomePageContentProps = {
  apiBaseUrl: string;
};

export function HomePageContent({ apiBaseUrl }: HomePageContentProps) {
  return (
    <>
      <HomeFeaturedShowcase />
      <HomeLatestListingsSection apiBaseUrl={apiBaseUrl} />
    </>
  );
}
