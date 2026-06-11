import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { Home } from "@/app/screens/Home";
import { Login } from "@/app/screens/Login";
import { Resume } from "@/app/screens/Resume";
import { Pin } from "@/app/screens/onboarding/Pin";
import { Name } from "@/app/screens/onboarding/Name";
import { Kyc } from "@/app/screens/onboarding/Kyc";
import { KycVerify } from "@/app/screens/onboarding/KycVerify";
import { KycStatus } from "@/app/screens/onboarding/KycStatus";
import { Done } from "@/app/screens/onboarding/Done";
import { AddMoney } from "@/app/screens/AddMoney";
import { Account } from "@/app/screens/Account";
import { TabLayout } from "@/app/screens/TabLayout";
import { Send } from "@/app/screens/Send";
import { Card } from "@/app/screens/Card";
import { Save } from "@/app/screens/Save";
import { Activity } from "@/app/screens/Activity";
import { TxDetail } from "@/app/screens/TxDetail";
import { RemitCompose } from "@/app/screens/RemitCompose";
import { RemitDetail } from "@/app/screens/RemitDetail";
import { More } from "@/app/screens/More";
import { Profile } from "@/app/screens/Profile";

// Protected-route gate: until Privy resolves, hold; unauthenticated → /login.
function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <Spinner />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Entry gate — resolve where an authenticated user should resume. */}
      <Route path="/" element={<Resume />} />
      <Route path="/login" element={<Login />} />

      {/* Onboarding funnel (pin → name → kyc → kyc-verify → kyc-status → done). */}
      <Route path="/onboarding/pin" element={<RequireAuth><Pin /></RequireAuth>} />
      <Route path="/onboarding/name" element={<RequireAuth><Name /></RequireAuth>} />
      <Route path="/onboarding/kyc" element={<RequireAuth><Kyc /></RequireAuth>} />
      <Route path="/onboarding/kyc-verify" element={<RequireAuth><KycVerify /></RequireAuth>} />
      <Route path="/onboarding/kyc-status" element={<RequireAuth><KycStatus /></RequireAuth>} />
      <Route path="/onboarding/done" element={<RequireAuth><Done /></RequireAuth>} />

      {/* Main app — persistent bottom tab bar (Home · Send · Card · Save · Activity). */}
      <Route element={<RequireAuth><TabLayout /></RequireAuth>}>
        <Route path="/home" element={<Home />} />
        <Route path="/send" element={<Send />} />
        <Route path="/card" element={<Card />} />
        <Route path="/save" element={<Save />} />
        <Route path="/activity" element={<Activity />} />
      </Route>

      {/* Full-screen routes off the tabs. */}
      <Route path="/tx/:id" element={<RequireAuth><TxDetail /></RequireAuth>} />
      <Route path="/add-money" element={<RequireAuth><AddMoney /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="/remit/compose" element={<RequireAuth><RemitCompose /></RequireAuth>} />
      <Route path="/remit/:id" element={<RequireAuth><RemitDetail /></RequireAuth>} />
      <Route path="/more" element={<RequireAuth><More /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
