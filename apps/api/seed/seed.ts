import "dotenv/config";
import mongoose from "mongoose";
import * as bcrypt from "bcrypt";
import { User, UserSchema } from "../src/database/schemas/user.schema";
import { Profile, ProfileSchema } from "../src/database/schemas/profile.schema";
import { ProfilePreferences, ProfilePreferencesSchema } from "../src/database/schemas/profile-preferences.schema";

const UserModel = mongoose.model(User.name, UserSchema);
const ProfileModel = mongoose.model(Profile.name, ProfileSchema);
const ProfilePreferencesModel = mongoose.model(ProfilePreferences.name, ProfilePreferencesSchema);

async function main() {
  await mongoose.connect(process.env.DATABASE_URL!);

  const username = process.env.SEED_USER_USERNAME ?? "taha";
  const password = process.env.SEED_USER_PASSWORD ?? "changeme123";

  let user = await UserModel.findOne({ username });
  if (!user) {
    user = await UserModel.create({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      displayName: "Taha",
    });
  }

  const profileNames = ["Taha", "Amar", "Maryam"];
  const profiles = [];
  for (const name of profileNames) {
    let profile = await ProfileModel.findOne({ userId: user.id, name });
    if (!profile) {
      profile = await ProfileModel.create({ userId: user.id, name });
      await ProfilePreferencesModel.create({ profileId: profile.id });
    }
    profiles.push(profile);
  }

  console.log("Seed complete.");
  console.log(`Login with: ${username} / ${password}`);
  console.log(`Profiles: ${profiles.map((p) => p.name).join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
