import clsx from "clsx";

export function StatusNotice({
  title,
  message,
  tone = "default",
}: {
  title: string;
  message: string;
  tone?: "default" | "error";
}) {
  return (
    <section
      className={clsx(
        "rounded-[8px] border px-[14px] py-2 mb-6",
        tone === "error"
          ? "border-[rgba(209,74,74,0.16)] bg-gradient-to-b from-[#fff4f4] to-[#fff9f8]"
          : "border-[rgba(240,97,180,0.16)] bg-gradient-to-b from-[#fff5f8] to-[#fffafb]",
      )}
      role="status"
    >
      <p className="text-[0.95rem] leading-[1.45] text-[#5c5c5c]">{message}</p>
    </section>
  );
}
