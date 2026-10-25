"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { usePageTranslation } from "../PageContent";

interface FocusItem {
  icon: string;
  title: string;
  description: string;
}

interface FocusAreasProps {
  backgroundImageUrl?: string;
  items?: FocusItem[];
  className?: string;
}

const defaultItems = [
  {
    icon: "focus-areas-icon-1.svg",
    titleKey: "main.focusAreas.items.security.title",
    descriptionKey: "main.focusAreas.items.security.description",
  },
  {
    icon: "focus-areas-icon-2.svg",
    titleKey: "main.focusAreas.items.drones.title",
    descriptionKey: "main.focusAreas.items.drones.description",
  },
  {
    icon: "focus-areas-icon-3.svg",
    titleKey: "main.focusAreas.items.automation.title",
    descriptionKey: "main.focusAreas.items.automation.description",
  },
  {
    icon: "focus-areas-icon-4.svg",
    titleKey: "main.focusAreas.items.ugv.title",
    descriptionKey: "main.focusAreas.items.ugv.description",
  },
  {
    icon: "focus-areas-icon-5.svg",
    titleKey: "main.focusAreas.items.defense.title",
    descriptionKey: "main.focusAreas.items.defense.description",
  },
  {
    icon: "focus-areas-icon-6.svg",
    titleKey: "main.focusAreas.items.automationAdvanced.title",
    descriptionKey: "main.focusAreas.items.automationAdvanced.description",
  },
];

const getRadialPositions = (count: number) => {
  const positions: { x: number; y: number }[] = [];
  const angleStep = 360 / count;
  const radius = 37;
  for (let i = 0; i < count; i++) {
    const angle = (i * angleStep - 90) * (Math.PI / 180);
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    positions.push({ x, y });
  }
  return positions;
};

const RadialCard = ({
  item,
  position,
}: {
  item: FocusItem;
  position: { x: number; y: number };
}) => {
  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="border-border/15 min-h-48 w-72 rounded-[18px] border-2 bg-white/5 p-4 shadow-lg backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:scale-[1.03] hover:border-white/30 hover:bg-white/15 hover:shadow-xl">
        <img src={item.icon} className="mb-3 h-10 w-10" alt="" />
        <h3 className="mb-1.5 text-lg font-bold text-white">{item.title}</h3>
        <p className="text-sm leading-6 text-white/75 capitalize">
          {item.description}
        </p>
      </div>
    </div>
  );
};

const RadialConnectors = ({ itemCount }: { itemCount: number }) => {
  const positions = getRadialPositions(itemCount);

  return (
    <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block">
      {positions.map((pos, idx) => (
        <line
          key={idx}
          x1="50%"
          y1="50%"
          x2={`${pos.x}%`}
          y2={`${pos.y}%`}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
};

export default function FocusAreas({ items }: FocusAreasProps) {
  const { t } = usePageTranslation();
  const resolvedItems =
    items ??
    defaultItems.map((item) => ({
      icon: item.icon,
      title: t(item.titleKey),
      description: t(item.descriptionKey),
    }));
  const containerRef = useRef<HTMLDivElement>(null);
  const positions = getRadialPositions(resolvedItems.length);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const floatLayer = useTransform(scrollYProgress, [0, 1], [2, -2]);
  const slowFloat = useTransform(scrollYProgress, [0, 1], [2, -2]);

  return (
    <section
      ref={containerRef}
      className={`relative overflow-hidden bg-[url('/site-bg.png')] bg-cover bg-center bg-no-repeat px-5 py-16 max-lg:py-12`}
    >
      <div
        aria-hidden="true"
        className="bg-background/75 absolute inset-0 z-0"
      />

      <div className="relative z-10 container mx-auto w-full">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 mt-60 h-190 w-px -translate-x-1/2 bg-linear-to-b from-transparent via-white/75 to-transparent max-md:h-360 lg:hidden" />
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="pointer-events-none relative z-20 text-center"
        >
          <h1 className="text-foreground text-4xl font-semibold capitalize lg:text-5xl">
            {t("main.focusAreas.title")}
          </h1>
        </motion.div>

        <motion.div
          style={{ y: floatLayer }}
          className="relative hidden w-full lg:mt-10 lg:block lg:h-[78vh] lg:max-h-[700px] lg:min-h-[620px]"
        >
          {resolvedItems.length ? (
            <RadialConnectors itemCount={resolvedItems.length} />
          ) : null}

          <motion.div
            style={{ y: slowFloat }}
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <img
              src="/focus-areas-core.svg"
              className="w-50 max-lg:w-32"
              alt=""
            />
          </motion.div>

          {resolvedItems.map((item, idx) => (
            <RadialCard
              key={idx}
              item={item}
              position={positions[idx] || { x: 50, y: 50 }}
            />
          ))}
        </motion.div>

        <div className="lg:hidden">
          <div className="flex justify-center">
            <img src="/focus-areas-core.svg" className="z-10 w-50" alt="" />
          </div>
          <div className="relative z-10 mt-12 grid grid-cols-2 gap-6 max-md:grid-cols-1">
            {resolvedItems.map((item, idx) => (
              <div
                key={idx}
                className="border-border/15 rounded-[18px] border-2 bg-white/5 p-4 shadow-lg backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/15 hover:shadow-xl"
              >
                <img src={item.icon} className="mb-3 h-8 w-8" alt="" />
                <h3 className="mb-1.5 text-base font-bold text-white">
                  {item.title}
                </h3>
                <p className="text-[13px] leading-5 text-white/75 capitalize">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
