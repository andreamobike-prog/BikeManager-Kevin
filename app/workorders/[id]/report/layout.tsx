export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="report-layout">
      <div className="report-layout__inner">{children}</div>
    </div>
  );
}