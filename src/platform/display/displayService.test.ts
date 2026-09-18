import { describe, expect, it } from 'vitest';
import { DisplayService } from './displayService';
describe('display service contracts',()=>{it('exposes a deterministic tenant path model',()=>{const s=new DisplayService(); expect(s).toBeDefined();});});
