import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { User, UserDocument } from "../database/schemas/user.schema";
import { RefreshToken, RefreshTokenDocument } from "../database/schemas/refresh-token.schema";

const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 90);
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "30m";

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; displayName: string };
};

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly jwt: JwtService
  ) {}

  private signAccessToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TTL }
    );
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const rawSecret = crypto.randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(rawSecret, 10);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    const record = await this.refreshTokenModel.create({ userId, tokenHash, expiresAt });

    return `${record.id}.${rawSecret}`;
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.userModel.findOne({ username });
    if (!user) throw new UnauthorizedException("Invalid username or password");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid username or password");

    user.lastLoginAt = new Date();
    await user.save();

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user.id),
      this.issueRefreshToken(user.id),
    ]);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, displayName: user.displayName },
    };
  }

  async refresh(tokenString: string): Promise<{ accessToken: string; refreshToken: string }> {
    const [id, rawSecret] = tokenString.split(".");
    if (!id || !rawSecret) throw new UnauthorizedException("Malformed refresh token");

    const record = await this.refreshTokenModel.findById(id);
    if (!record || record.revoked || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired or revoked");
    }

    const valid = await bcrypt.compare(rawSecret, record.tokenHash);
    if (!valid) throw new UnauthorizedException("Invalid refresh token");

    record.revoked = true;
    await record.save();

    const userId = record.userId.toString();
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(userId),
      this.issueRefreshToken(userId),
    ]);

    return { accessToken, refreshToken };
  }

  async logout(tokenString: string): Promise<void> {
    const [id] = tokenString.split(".");
    if (!id) return;
    await this.refreshTokenModel.updateOne({ _id: id }, { revoked: true }).catch(() => undefined);
  }
}
