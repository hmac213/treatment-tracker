"use client";

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showProductName?: boolean;
};

export function BrandLogo({
  className = "",
  imageClassName = "h-8 w-auto",
  showProductName = true,
}: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <img
        src="/UCLA_H_2019_RGB.png"
        alt="UCLA Health"
        className={imageClassName}
      />
      {showProductName && (
        <div className="text-sm font-semibold tracking-tight text-slate-800">
          Treatment Tracker
        </div>
      )}
    </div>
  );
}
