import { useEffect } from "react";

export default function AdminLoginRedirect() {
  useEffect(() => {
    window.location.href = "/login";
  }, []);

  return null;
}