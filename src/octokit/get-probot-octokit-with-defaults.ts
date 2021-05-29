import { Deprecation } from "deprecation";
import LRUCache from "lru-cache";
import { ProbotOctokit } from "./probot-octokit";
import Redis from "ioredis";

import { getOctokitThrottleOptions } from "./get-octokit-throttle-options";

import type { Logger } from "pino";

type Options = {
  cache: LRUCache<number, string>;
  Octokit: typeof ProbotOctokit;
  log: Logger;
  githubToken?: string;
  appId?: number;
  privateKey?: string;
  redisConfig?: Redis.RedisOptions | string;
  throttleOptions?: any;
  baseUrl?: string;
};

/**
 * Returns an Octokit instance with default settings for authentication. If
 * a `githubToken` is passed explicitly, the Octokit instance will be
 * pre-authenticated with that token when instantiated. Otherwise Octokit's
 * app authentication strategy is used, and `options.auth` options are merged
 * deeply when instantiated.
 *
 * Besides the authentication, the Octokit's baseUrl is set as well when run
 * against a GitHub Enterprise Server with a custom domain.
 */
export function getProbotOctokitWithDefaults(options: Options) {
  const authOptions = options.githubToken
    ? {
        token: options.githubToken,
      }
    : {
        cache: options.cache,
        appId: options.appId,
        privateKey: options.privateKey,
      };

  const octokitThrottleOptions = getOctokitThrottleOptions({
    log: options.log,
    redisConfig: options.redisConfig,
  });

  if (!options.baseUrl && process.env.GHE_HOST) {
    options.baseUrl = `${process.env.GHE_PROTOCOL || "https"}://${
      process.env.GHE_HOST
    }/api/v3`;

    options.log.warn(
      new Deprecation(
        `[probot] "GHE_HOST"/"GHE_PROTOCOL" is deprecated when using with the Probot constructor. Use "new Probot({ baseUrl: 'https://github.acme-inc.com/api/v3' })" instead`
      )
    );
  }

  const defaultOptions: any = {
    baseUrl: options.baseUrl,
    auth: authOptions,
  };

  if (options.throttleOptions || octokitThrottleOptions) {
    defaultOptions.throttle = Object.assign(
      {},
      options.throttleOptions,
      octokitThrottleOptions
    );
  }

  return options.Octokit.defaults((instanceOptions: any) => {
    const options = Object.assign({}, defaultOptions, instanceOptions, {
      auth: instanceOptions.auth
        ? Object.assign({}, defaultOptions.auth, instanceOptions.auth)
        : defaultOptions.auth,
    });

    if (instanceOptions.throttle) {
      options.throttle = Object.assign(
        {},
        defaultOptions.throttle,
        instanceOptions.throttle
      );
    }

    return options;
  });
}
