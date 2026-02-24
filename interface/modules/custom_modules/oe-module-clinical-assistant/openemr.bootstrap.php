<?php

/**
 * Clinical Assistant Sidebar module bootstrap
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @author    OpenEMR Community
 * @copyright Copyright (c) 2026 OpenEMR
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\ClinicalAssistant;

/**
 * @global OpenEMR\Core\ModulesClassLoader $classLoader
 */
$classLoader->registerNamespaceIfNotExists('OpenEMR\\Modules\\ClinicalAssistant\\', __DIR__ . DIRECTORY_SEPARATOR . 'src');

$bootstrap = new Bootstrap();
$bootstrap->subscribeToEvents($eventDispatcher);
