import { PageContentProvider } from "../../components/PageContent";
import { lazy, startTransition, Suspense, useEffect, useState } from "react";
import Hero from "../../components/home/Hero";
import { useInViewOnce } from "../../hooks/use-in-view-once";

const DroneCarousel = lazy(() => import("../../components/home/DroneCarousel"));
const FocusAreas = lazy(() => import("../../components/home/FocusAreas"));
const SystemIntegration = lazy(
  () => import("../../components/home/SystemIntegration"),
);
const CustomerBenefits = lazy(
  () => import("../../components/home/CustomerBenefits"),
);
const BlogPosts = lazy(() => import("../../components/home/BlogPosts"));

function HomeSectionsFallback() {
  return (
    <div aria-hidden="true" className="space-y-10 pb-20 max-md:space-y-8">
      <section className="container mx-auto px-5 py-20 max-md:py-14">
        <div className="space-y-4">
          <div className="h-3 w-28 animate-pulse rounded-full bg-white/12" />
          <div className="h-11 w-full max-w-2xl animate-pulse rounded-full bg-white/14 max-md:h-9" />
          <div className="h-5 w-full max-w-3xl animate-pulse rounded-full bg-white/10 max-md:h-4" />
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-sm"
            >
              <div className="aspect-5/7 animate-pulse bg-white/10" />
              <div className="space-y-3 p-5">
                <div className="h-6 w-3/4 animate-pulse rounded-full bg-white/12" />
                <div className="h-4 w-full animate-pulse rounded-full bg-white/8" />
                <div className="h-4 w-5/6 animate-pulse rounded-full bg-white/8" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-10 max-md:py-6">
        <div className="container mx-auto rounded-[36px] border border-white/10 bg-white/4 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm max-md:rounded-[28px] max-md:p-4">
          <div className="mx-auto max-w-2xl space-y-4 text-center">
            <div className="mx-auto h-3 w-24 animate-pulse rounded-full bg-white/12" />
            <div className="mx-auto h-10 w-full max-w-xl animate-pulse rounded-full bg-white/14 max-md:h-8" />
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="rounded-3xl border border-white/10 bg-white/5 p-5"
              >
                <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/12" />
                <div className="mt-4 h-5 w-2/3 animate-pulse rounded-full bg-white/12" />
                <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/8" />
                <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-white/8" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() { return <PageContentProvider site="ai-def" slug="home"><HomeContent /></PageContentProvider>; }

function HomeContent() {
  const { ref: deferredSectionsRef, inView } = useInViewOnce({
    rootMargin: "0px",
  });
  const [shouldLoadDeferredSections, setShouldLoadDeferredSections] =
    useState(false);

  useEffect(() => {
    if (!inView) {
      return;
    }

    startTransition(() => {
      setShouldLoadDeferredSections(true);
    });
  }, [inView]);

  return (
    <main className="relative min-h-screen">
      <Hero />
      <div
        ref={deferredSectionsRef}
        className="h-px w-full"
        aria-hidden="true"
      />
      {shouldLoadDeferredSections ? (
        <Suspense fallback={<HomeSectionsFallback />}>
          <DroneCarousel />
          <FocusAreas />
          <SystemIntegration />
          <BlogPosts />
          <CustomerBenefits />
        </Suspense>
      ) : (
        <HomeSectionsFallback />
      )}
    </main>
  );
}
