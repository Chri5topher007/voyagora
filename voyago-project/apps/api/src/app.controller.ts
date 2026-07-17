
import { Controller } from '@nestjs/common';

// The actual health check (with DB connectivity check) lives in
// HealthController now. This used to also define GET /health with a
// no-op response, which — because AppController was registered first in
// app.module.ts — silently shadowed the real one, the same class of
// route-ordering bug fixed elsewhere in this app.
@Controller()
export class AppController {}
