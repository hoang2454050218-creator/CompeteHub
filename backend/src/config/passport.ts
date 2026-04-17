import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { config } from './index';

interface OAuthProfile {
  id: string;
  displayName?: string;
  username?: string;
  name?: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  profileUrl?: string;
}

export function initPassport() {
  if (config.oauth.google.clientId) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.oauth.google.clientId,
          clientSecret: config.oauth.google.clientSecret,
          callbackURL: config.oauth.google.callbackUrl,
        },
        (_accessToken, _refreshToken, profile: GoogleProfile, done) => {
          done(null, profile as unknown as Express.User);
        }
      )
    );
  }

  if (config.oauth.github.clientId) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.oauth.github.clientId,
          clientSecret: config.oauth.github.clientSecret,
          callbackURL: config.oauth.github.callbackUrl,
        },
        (_accessToken: string, _refreshToken: string, profile: OAuthProfile, done: (err: Error | null, user?: Express.User) => void) => {
          done(null, profile as unknown as Express.User);
        }
      )
    );
  }

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user: Express.User, done) => done(null, user));
}
