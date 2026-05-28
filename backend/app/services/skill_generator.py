from ..models import Skill


def generate_skill_from_segments() -> Skill:
    return Skill(
        id="skill_001",
        software="Photoshop",
        skill_name="利用曲线与蒙版实现局部曝光控制",
        level="Intermediate",
        tags=["曲线", "蒙版", "曝光调整"],
        description="使用曲线调整层结合蒙版控制画面局部亮度，避免全局曝光漂移。",
        steps=["创建曲线调整层", "提升高光区域", "添加黑色蒙版", "白色画笔擦出目标区域"],
        shortcut=["Ctrl+M", "B"],
        timestamp="03:12-04:25",
        confidence=0.92,
        quality=94,
    )


def demo_skills() -> list[Skill]:
    return [
        generate_skill_from_segments(),
        Skill(
            id="skill_002",
            software="Photoshop",
            skill_name="Camera Raw 高光恢复与阴影细节平衡",
            level="Intermediate",
            tags=["Camera Raw", "高光", "阴影"],
            description="通过 Camera Raw 压低高光并提升阴影细节，同时控制白色色阶保留动态范围。",
            steps=["打开 Camera Raw", "降低高光", "提升阴影", "微调白色色阶"],
            shortcut=["Ctrl+Shift+A"],
            timestamp="04:28-05:36",
            confidence=0.89,
            quality=91,
        ),
    ]
