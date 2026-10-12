// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;

/// If a URL contains '?code=...' or OAuth query params but there is no corresponding
/// code verifier in localStorage, this is a stale or reloaded callback URL.
/// Stripping the query params prevents Supabase from attempting a PKCE exchange that crashes.
void sanitizeAuthUrl() {
  try {
    final location = html.window.location;
    final search = location.search;
    if (search != null && search.contains('code=')) {
      bool hasVerifier = false;
      for (final key in html.window.localStorage.keys) {
        if (key.contains('code-verifier')) {
          hasVerifier = true;
          break;
        }
      }
      if (!hasVerifier) {
        final uri = Uri.parse(location.href);
        final cleanParams = Map<String, String>.from(uri.queryParameters)
          ..remove('code')
          ..remove('state');
        final cleanUrl = uri
            .replace(queryParameters: cleanParams.isEmpty ? null : cleanParams)
            .toString();
        html.window.history.replaceState(null, '', cleanUrl);
      }
    }
  } catch (_) {}
}

/// After Supabase processes OAuth redirect, remove auth query parameters from the browser URL
/// so that subsequent page refreshes don't re-trigger PKCE code exchange with a consumed code.
void cleanAuthUrl() {
  try {
    final location = html.window.location;
    final uri = Uri.parse(location.href);
    if (uri.queryParameters.containsKey('code') ||
        uri.queryParameters.containsKey('error') ||
        uri.fragment.contains('access_token')) {
      final cleanParams = Map<String, String>.from(uri.queryParameters)
        ..remove('code')
        ..remove('state')
        ..remove('error')
        ..remove('error_description')
        ..remove('error_code');
      final cleanUrl = uri
          .replace(
            queryParameters: cleanParams.isEmpty ? null : cleanParams,
            fragment: '',
          )
          .toString();
      html.window.history.replaceState(null, '', cleanUrl);
    }
  } catch (_) {}
}
