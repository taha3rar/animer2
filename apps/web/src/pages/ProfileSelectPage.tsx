import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { useProfileStore } from "../store/useProfileStore";
import { Focusable } from "../tv-navigation/Focusable";
import { useAutoFocus } from "../tv-navigation/useAutoFocus";

export function ProfileSelectPage() {
  const navigate = useNavigate();
  const setActiveProfile = useProfileStore((s) => s.setActiveProfile);
  const { data: profiles, isLoading, error } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => apiClient.getProfiles(),
  });

  useAutoFocus([profiles]);

  if (isLoading) return <div className="center-message">Loading profiles…</div>;
  if (error) return <div className="center-message error-text">Could not load profiles.</div>;

  return (
    <div className="screen">
      <h1>Who's watching?</h1>
      <div className="profile-grid">
        {profiles?.map((profile) => (
          <Focusable
            key={profile.id}
            className="profile-card"
            onClick={() => {
              setActiveProfile(profile);
              navigate("/", { replace: true });
            }}
          >
            <span className="avatar-circle">{profile.name.charAt(0).toUpperCase()}</span>
            {profile.name}
          </Focusable>
        ))}
      </div>
    </div>
  );
}
