import { usePrivy } from "@privy-io/react-auth";
import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { captureReferralFromUrl } from "@/lib/referral";
import { Home } from "@/app/screens/Home";
import { Login } from "@/app/screens/Login";
import { Welcome } from "@/app/screens/Welcome";
import { Resume } from "@/app/screens/Resume";
import { Pin } from "@/app/screens/onboarding/Pin";
import { Name } from "@/app/screens/onboarding/Name";
import { Tos } from "@/app/screens/onboarding/Tos";
import { Kyc } from "@/app/screens/onboarding/Kyc";
import { KycVerify } from "@/app/screens/onboarding/KycVerify";
import { KycStatus } from "@/app/screens/onboarding/KycStatus";
import { Done } from "@/app/screens/onboarding/Done";
import { AddMoney } from "@/app/screens/AddMoney";
import { AddMoneyAch } from "@/app/screens/AddMoneyAch";
import { AddMoneySource } from "@/app/screens/AddMoneySource";
import { OnrampAmount } from "@/app/screens/OnrampAmount";
import { OnrampReview } from "@/app/screens/OnrampReview";
import { OnrampAuthorize } from "@/app/screens/OnrampAuthorize";
import { OnrampStatus } from "@/app/screens/OnrampStatus";
import { Account } from "@/app/screens/Account";
import { TabLayout } from "@/app/screens/TabLayout";
import { Send } from "@/app/screens/Send";
import { Card } from "@/app/screens/Card";
import { OrderPhysical } from "@/app/screens/OrderPhysical";
import { CardPin } from "@/app/screens/CardPin";
import { Save } from "@/app/screens/Save";
import { SaveAmount } from "@/app/screens/save/Amount";
import { SaveResult } from "@/app/screens/save/Result";
import { SaveWithdraw } from "@/app/screens/save/Withdraw";
import { SavePassbook } from "@/app/screens/save/Passbook";
import { Activity } from "@/app/screens/Activity";
import { TxDetail } from "@/app/screens/TxDetail";
import { RemitCompose } from "@/app/screens/RemitCompose";
import { RemitDetail } from "@/app/screens/RemitDetail";
import { More } from "@/app/screens/More";
import { Invite } from "@/app/screens/Invite";
import { InviteTracker } from "@/app/screens/InviteTracker";
import { Profile } from "@/app/screens/Profile";
import { About } from "@/app/screens/About";
import { Passbook } from "@/app/screens/Passbook";
import { InterestDetail } from "@/app/screens/InterestDetail";

// Protected-route gate: until Privy resolves, hold; unauthenticated → /login.
function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <Spinner />;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Guest-only gate: the pre-auth screens (/welcome, /login). An authenticated user
// is bounced to "/" (Resume), which resolves their correct onboarding/home step —
// so a logged-in user can never sit on /welcome or /login.
function RequireGuest({ children }: { children: ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <Spinner />;
  if (authenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  // Capture an invite code from the launch URL (D133): a deep-link recipient lands
  // on any path with ?code=… / ?ref=… (e.g. /welcome?code=1234567). Stash it in
  // localStorage until signup consumes it — independent of where the URL routes, and
  // it survives the email-OTP round-trip. Capture is best-effort / never blocks.
  useEffect(() => {
    captureReferralFromUrl(window.location.href);
  }, []);

  return (
    <Routes>
      {/* Entry gate — resolve where an authenticated user should resume. */}
      <Route path="/" element={<Resume />} />
      <Route path="/welcome" element={<RequireGuest><Welcome /></RequireGuest>} />
      <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />

      {/* Onboarding funnel (pin → name → tos → kyc → kyc-verify → kyc-status → done). */}
      <Route path="/onboarding/pin" element={<RequireAuth><Pin /></RequireAuth>} />
      <Route path="/onboarding/name" element={<RequireAuth><Name /></RequireAuth>} />
      <Route path="/onboarding/tos" element={<RequireAuth><Tos /></RequireAuth>} />
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
      <Route path="/interest/:id" element={<RequireAuth><InterestDetail /></RequireAuth>} />
      <Route path="/passbook" element={<RequireAuth><Passbook /></RequireAuth>} />
      <Route path="/about" element={<RequireAuth><About /></RequireAuth>} />
      <Route path="/add-money" element={<RequireAuth><AddMoney /></RequireAuth>} />
      <Route path="/add-money-ach" element={<RequireAuth><AddMoneyAch /></RequireAuth>} />
      <Route path="/add-money-source" element={<RequireAuth><AddMoneySource /></RequireAuth>} />
      <Route path="/ph-onramp/amount" element={<RequireAuth><OnrampAmount /></RequireAuth>} />
      <Route path="/ph-onramp/review" element={<RequireAuth><OnrampReview /></RequireAuth>} />
      <Route path="/ph-onramp/authorize" element={<RequireAuth><OnrampAuthorize /></RequireAuth>} />
      <Route path="/ph-onramp/status" element={<RequireAuth><OnrampStatus /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="/save/amount" element={<RequireAuth><SaveAmount /></RequireAuth>} />
      <Route path="/save/withdraw" element={<RequireAuth><SaveWithdraw /></RequireAuth>} />
      <Route path="/save/passbook" element={<RequireAuth><SavePassbook /></RequireAuth>} />
      <Route path="/save/result" element={<RequireAuth><SaveResult /></RequireAuth>} />
      <Route path="/card/order-physical" element={<RequireAuth><OrderPhysical /></RequireAuth>} />
      <Route path="/card/pin" element={<RequireAuth><CardPin /></RequireAuth>} />
      <Route path="/remit/compose" element={<RequireAuth><RemitCompose /></RequireAuth>} />
      <Route path="/remit/:id" element={<RequireAuth><RemitDetail /></RequireAuth>} />
      <Route path="/more" element={<RequireAuth><More /></RequireAuth>} />
      <Route path="/invite" element={<RequireAuth><Invite /></RequireAuth>} />
      <Route path="/invite-tracker" element={<RequireAuth><InviteTracker /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
