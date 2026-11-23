import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { ApiError } from "@/lib/error";
import { requireActor } from "@/lib/auth/guards";
import { authorizeUserChannel } from "@/app/services/realtime-service";

export const POST = withApiHandler(async (req) => {
  const actor = await requireActor(req);
  if (actor.type !== "user") {
    throw new ApiError(403, "USER_SESSION_REQUIRED", "A human user session is required.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "INVALID_PUSHER_AUTH_REQUEST", "Expected form data from Pusher.");
  }

  const socketId = form.get("socket_id");
  const channelName = form.get("channel_name");
  if (typeof socketId !== "string" || !socketId || typeof channelName !== "string" || !channelName) {
    throw new ApiError(400, "INVALID_PUSHER_AUTH_REQUEST", "Pusher socket and channel values are required.");
  }
  if (channelName !== `private-user-${actor.user.id}`) {
    throw new ApiError(403, "CHANNEL_FORBIDDEN", "You can only subscribe to your own private channel.");
  }

  return NextResponse.json(authorizeUserChannel(socketId, channelName));
});
