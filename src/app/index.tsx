import { Access } from "@/components/pos/Access";
import { Workspace } from "@/components/pos/Workspace";
export default function HomeScreen() {
  return (
    <Access
      render={(restaurant, profile, change) => (
        <Workspace restaurant={restaurant} profile={profile} change={change} />
      )}
    />
  );
}
