<?php

/**
 * Clinical Assistant Sidebar module event wiring
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    OpenEMR Community
 * @copyright Copyright (c) 2026 OpenEMR
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\ClinicalAssistant;

use OpenEMR\Common\Utils\CacheUtils;
use OpenEMR\Events\Core\ScriptFilterEvent;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;

class Bootstrap
{
    private const EMBED_SCRIPT = '/interface/modules/custom_modules/oe-module-clinical-assistant/public/assets/embed.js';

    public function subscribeToEvents(EventDispatcherInterface $eventDispatcher): void
    {
        $eventDispatcher->addListener(ScriptFilterEvent::EVENT_NAME, $this->injectEmbedScript(...));
    }

    public function injectEmbedScript(ScriptFilterEvent $event): void
    {
        $scripts = $event->getScripts();
        $script = CacheUtils::addAssetCacheParamToPath(self::EMBED_SCRIPT);
        if (!in_array($script, $scripts, true)) {
            $scripts[] = $script;
            $event->setScripts($scripts);
        }
    }
}
