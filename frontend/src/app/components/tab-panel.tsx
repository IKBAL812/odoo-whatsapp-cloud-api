import TabPanelSwitcher from "./tab-panel/index";

export default function TabPanel() {
  return (
    <section className="col-span-7 h-full min-h-0 w-full relative bg-black/90 border-r-[1px] border-gray-300/20 flex flex-col overflow-hidden">
      <TabPanelSwitcher />
    </section>
  );
}
