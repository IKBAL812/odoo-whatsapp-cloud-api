import TabPanelSwitcher from "./tab-panel/index";

export default function TabPanel() {
  return (
    <section className="col-span-7 h-full min-h-0 w-full relative bg-[rgb(var(--bg-primary)/0.9)] border-r-[1px] border-[rgb(var(--border-primary)/var(--border-primary-opacity))] flex flex-col overflow-hidden">
      <TabPanelSwitcher />
    </section>
  );
}
